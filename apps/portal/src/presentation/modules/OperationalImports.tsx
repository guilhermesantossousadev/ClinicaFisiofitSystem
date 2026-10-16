import { requestText, confirmAction } from '../components/Decisions';
import { Notice, Tabs } from "@fisiofit/design-system/react";
import { SectionIntro, useModuleState } from "../components/ModuleWorkspace";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { statusLabel } from "./OperationalShared";

type Row = Record<string, unknown>;
type ImportBatch = Row & { id: string; rollback_at?: string | null };

const entityOptions = [
  ["units", "Unidades"], ["rooms", "Salas"], ["professionals", "Profissionais"], ["services", "Serviços"],
  ["plans", "Planos"], ["patients", "Pacientes"], ["enrollments", "Matrículas"], ["appointments", "Agendamentos"],
  ["group_slots", "Turmas"], ["charges", "Cobranças"], ["payments", "Pagamentos"],
  ["financial_entries", "Lançamentos financeiros"], ["commissions", "Comissões"], ["clinical_records", "Prontuários"], ["record_templates", "Modelos clínicos"],
] as const;

const csvFileSchema = z.object({
  name: z.string().regex(/\.csv$/i, "Selecione um arquivo com extensão .csv."),
  size: z.number().positive("O arquivo está vazio.").max(10 * 1024 * 1024, "O CSV deve ter no máximo 10 MB."),
});
const csvRowsSchema = z.array(z.record(z.unknown())).min(1, "O CSV não contém linhas de dados.");

function messageOf(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "CSV inválido.";
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function normalizeHeader(header: string) {
  return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseCsv(file: File) {
  return new Promise<Row[]>((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete(result) {
        if (result.errors.length) {
          reject(new Error(`CSV inválido na linha ${result.errors[0]?.row ?? 1}: ${result.errors[0]?.message}`));
          return;
        }
        try {
          const parsed = csvRowsSchema.parse(result.data).map((row) =>
            // Functions cannot be cloned into Papa's Worker configuration.
            // Normalize on the main thread after the worker returns parsed rows.
            Object.fromEntries(Object.entries(row).map(([key, cell]) => [normalizeHeader(key), String(cell ?? "").trim() || undefined])),
          );
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      error(error) { reject(error); },
    });
  });
}

export default function OperationalImports({canEdit = true}:{canEdit?:boolean}) {
  const [units, setUnits] = useState<Row[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [entity, setEntity] = useState("patients");
  const [preview, setPreview] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [notionBusy, setNotionBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const csvPending = useRef(false);
  const [notionValidated, setNotionValidated] = useState(false);
  const [csvValidated, setCsvValidated] = useState(false);
  const [storedSourceTab, setSourceTab] = useModuleState("imports.tab", "csv");
  const sourceTab = canEdit ? storedSourceTab : 'history';
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [unitResponse, importResponse] = await Promise.all([api<Row[]>("/units"), api<ImportBatch[]>("/imports")]);
      setUnits(unitResponse.data ?? []);
      setBatches(importResponse.data ?? []);
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setCsvValidated(false);
    try {
      csvFileSchema.parse({ name: file.name, size: file.size });
      const parsedRows = await parseCsv(file);
      setFilename(file.name);
      setRows(parsedRows);
      setNotice(`${parsedRows.length} linhas carregadas e validadas.`);
    } catch (error) {
      event.target.value = "";
      setFilename("");
      setRows([]);
      setNotice(`Erro: ${messageOf(error)}`);
    }
  }

  async function run(event: FormEvent<HTMLFormElement>, dryRun: boolean) {
    event.preventDefault();
    if (!canEdit || csvPending.current) return;
    if (!dryRun && (!csvValidated || !await confirmAction(`Importar as linhas válidas de ${filename}? Confira as rejeições antes de confirmar.`, {title:'Confirmar importação',confirmLabel:'Importar linhas válidas'}))) return;
    csvPending.current = true; setCsvBusy(true);
    try {
      const response = await api<Row>("/imports/workbook", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({
          filename,
          dryRun,
          sheets: [{ name: filename.replace(/\.csv$/i, ""), entity, rows }],
        }),
      });
      setPreview(response.data);
      setCsvValidated(dryRun);
      const rejected = Array.isArray(response.data?.issues) ? response.data.issues.length : Array.isArray(response.data?.rejected) ? response.data.rejected.length : 0;
      setNotice(dryRun ? "Pré-validação concluída. Confira o resumo antes de importar." : rejected ? `Processamento concluído com ${rejected} linha(s) rejeitada(s). Confira o relatório.` : "Importação concluída.");
      if (!dryRun) await reload();
    } catch (error) {
      setNotice(`Erro: ${messageOf(error)}`);
    } finally { csvPending.current = false; setCsvBusy(false); }
  }

  async function runNotion(form: HTMLFormElement, dryRun: boolean) {
    if (!canEdit) return;
    const unitId = String(new FormData(form).get("unit_id") ?? "");
    if (!unitId) { setNotice("Selecione a unidade de destino antes de conectar o Notion."); return; }
    if (!dryRun && (!notionValidated || !await confirmAction('Importar os registros válidos do Notion para a unidade selecionada?', {title:'Confirmar importação',confirmLabel:'Importar registros válidos'}))) return;
    setNotionBusy(true);
    try {
      const response = await api<Row>("/imports/notion", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({ unit_id: unitId, dryRun }),
      });
      setPreview(response.data);
      setNotionValidated(dryRun);
      setNotice(dryRun ? "Pré-validação do Notion concluída. Nenhum dado foi importado." : "Importação do Notion concluída e registrada.");
    } catch (error) {
      setNotice(`Erro: ${messageOf(error)}`);
    } finally {
      setNotionBusy(false);
    }
  }

  async function rollbackBatch(id: string) {
    const reason = await requestText("Informe o motivo da reversão do lote (mínimo de 10 caracteres):");
    if (!reason) return;
    try {
      await api(`/imports/${id}/rollback`, { method: "POST", body: JSON.stringify({ reason }) });
      await reload();
      setNotice("Lote revertido.");
    } catch (error) { setNotice(`Erro: ${messageOf(error)}`); }
  }

  return <div className="content">
    <div className="page-title"><div><p className="eyebrow">MIGRAÇÃO RASTREÁVEL</p><h1>Importações</h1><p>Importe CSVs com validação, deduplicação e lote auditável.</p></div></div>
    {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
    {loading && <div className="card module-skeleton" role="status">Carregando dados do módulo…</div>}
    {loadError && <div className="system-message error-message" role="alert"><p>{loadError}</p><button type="button" className="btn secondary" onClick={() => void reload()}>Tentar novamente</button></div>}
    <Tabs id="import-source" label="Origem e histórico de importação" value={sourceTab} onChange={tab => { setSourceTab(tab); setPreview(null); setCsvValidated(false); setNotionValidated(false); }} items={[...(canEdit ? [{value:'csv',label:'Arquivo CSV'},{value:'notion',label:'Notion'}] : []),{value:'history',label:'Histórico de lotes'}]} />
    <section role="tabpanel" id={`import-source-panel-${sourceTab}`} aria-labelledby={`import-source-${sourceTab}`} tabIndex={0}>
    {sourceTab !== 'history' && <><SectionIntro title="Revise antes de importar">Selecione a origem, execute a pré-validação e confira as linhas rejeitadas. A gravação exige uma confirmação separada.</SectionIntro><ol className="import-progress" aria-label="Etapas da importação"><li>1. Selecionar origem</li><li className={rows.length || notionValidated ? 'complete' : ''}>2. Pré-validar</li><li className={csvValidated || notionValidated ? 'complete' : ''}>3. Revisar e confirmar</li></ol>
    <form className="card modal-form" onSubmit={(event) => void run(event, true)}>
      {sourceTab === 'notion' && <>
      <div className="form-row">
        <SelectField name="unit_id" label="Unidade de destino" required onChange={() => { setNotionValidated(false); setPreview(null); }}><option value="">Selecione</option>{units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{String(unit.name)}</option>)}</SelectField>
      </div>
      <section className="notion-import-panel" aria-labelledby="notion-import-title">
        <h2 id="notion-import-title">Importação direta do Notion</h2><p>Lê somente o espaço autorizado e não grava dados durante a pré-validação.</p>
        <button className="btn secondary" type="button" disabled={notionBusy} onClick={(event) => void runNotion(event.currentTarget.closest("form") as HTMLFormElement, true)}>{notionBusy ? "Lendo o Notion…" : "Conectar e pré-validar Notion"}</button>
        {notionValidated && <button className="btn primary" type="button" disabled={notionBusy} onClick={(event) => void runNotion(event.currentTarget.closest("form") as HTMLFormElement, false)}>Importar válidos do Notion</button>}
      </section>
      </>}
      {sourceTab === 'csv' && <>
      <TextField label="Arquivo CSV" type="file" accept=".csv,text/csv" disabled={csvBusy} onChange={(event) => void choose(event)} required />
      <SelectField label="Tipo de informação" disabled={csvBusy} value={entity} onChange={(event) => { setEntity(event.target.value); setPreview(null); setCsvValidated(false); }}>{entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <p>{rows.length} linhas carregadas.{filename && ` Arquivo: ${filename}`}</p>
      <div className="title-actions"><button className="btn secondary" type="submit" disabled={!rows.length || csvBusy || notionBusy}>{csvBusy ? "Validando…" : "Pré-validar"}</button><button className="btn primary" type="button" disabled={!csvValidated || csvBusy || notionBusy} onClick={(event) => void run({ preventDefault() {}, currentTarget: event.currentTarget.closest("form") as HTMLFormElement } as FormEvent<HTMLFormElement>, false)}>{csvBusy ? "Importando…" : "Importar válidos"}</button></div>
      </>}
      {preview && <ImportReview preview={preview} />}
    </form>
    </>}
    {sourceTab === 'history' && <section className="card table-card operational-data-table"><div className="table-toolbar"><h2>Histórico de lotes</h2><span>{batches.length} registros</span></div>{batches.map((batch) => <div className="operational-row" key={batch.id}><div><strong>{String(batch.filename ?? "Importação")}</strong><small>{statusLabel(batch.status)} · {batch.created_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(String(batch.created_at))) : "Data não informada"}</small></div>{canEdit && !batch.rollback_at && <button type="button" onClick={() => void rollbackBatch(batch.id)}>Reverter lote</button>}</div>)}{!batches.length && <div className="empty-state">Nenhuma importação foi executada até agora.</div>}</section>}
    </section>
  </div>;
}

function ImportReview({preview}:{preview:Row}) {
  const issues = (Array.isArray(preview.issues) ? preview.issues : Array.isArray(preview.rejected) ? preview.rejected : []) as Row[];
  return <section className="import-review" aria-labelledby="import-review-title"><h2 id="import-review-title">Resumo da validação</h2><p role="status">Aceitos: {String(preview.accepted ?? preview.imported ?? preview.total ?? 0)} · Ocorrências para revisão: {issues.length}</p>{issues.length > 0 && <div className="ff-table-scroll" tabIndex={0} role="region" aria-label="Linhas com problemas"><table><caption>Corrija no arquivo de origem e execute a pré-validação novamente.</caption><thead><tr><th scope="col">Linha</th><th scope="col">Motivo</th></tr></thead><tbody>{issues.map((issue,index) => <tr key={index}><td>{String(issue.row ?? '—')}</td><td>{String(issue.reason ?? 'Revise os dados desta linha.')}</td></tr>)}</tbody></table></div>}</section>;
}
