import { type FormEvent, useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";

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
      transformHeader: normalizeHeader,
      complete(result) {
        if (result.errors.length) {
          reject(new Error(`CSV inválido na linha ${result.errors[0]?.row ?? 1}: ${result.errors[0]?.message}`));
          return;
        }
        try {
          const parsed = csvRowsSchema.parse(result.data).map((row) =>
            Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, String(cell ?? "").trim() || undefined])),
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

export default function OperationalImports() {
  const [units, setUnits] = useState<Row[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [entity, setEntity] = useState("patients");
  const [preview, setPreview] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionValidated, setNotionValidated] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [unitResponse, importResponse] = await Promise.all([api<Row[]>("/units"), api<ImportBatch[]>("/imports")]);
      setUnits(unitResponse.data ?? []);
      setBatches(importResponse.data ?? []);
    } catch (error) {
      setNotice(`Erro: ${messageOf(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
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
      setNotice(messageOf(error));
    }
  }

  async function run(event: FormEvent<HTMLFormElement>, dryRun: boolean) {
    event.preventDefault();
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
      setNotice(dryRun ? "Pré-validação concluída." : "Importação concluída.");
      if (!dryRun) await reload();
    } catch (error) {
      setNotice(`Erro: ${messageOf(error)}`);
    }
  }

  async function runNotion(form: HTMLFormElement, dryRun: boolean) {
    const unitId = String(new FormData(form).get("unit_id") ?? "");
    if (!unitId) { setNotice("Selecione a unidade de destino antes de conectar o Notion."); return; }
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
    const reason = window.prompt("Informe o motivo do rollback (mínimo 10 caracteres):");
    if (!reason) return;
    try {
      await api(`/imports/${id}/rollback`, { method: "POST", body: JSON.stringify({ reason }) });
      await reload();
      setNotice("Lote revertido.");
    } catch (error) { setNotice(`Erro: ${messageOf(error)}`); }
  }

  return <div className="content">
    <div className="page-title"><div><p className="eyebrow">MIGRAÇÃO RASTREÁVEL</p><h1>Importações</h1><p>Importe CSVs com validação, deduplicação e lote auditável.</p></div></div>
    {notice && <div className="toast" role="status"><span aria-hidden="true">✓</span>{notice}</div>}
    {loading && <div className="card module-skeleton" role="status">Carregando dados do módulo…</div>}
    <form className="card modal-form" onSubmit={(event) => void run(event, true)}>
      <div className="form-row">
        <SelectField name="source" label="Origem"><option value="manual">CSV manual</option><option value="oluma">Oluma</option><option value="notion">Notion</option></SelectField>
        <SelectField name="unit_id" label="Unidade de destino" required><option value="">Selecione</option>{units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{String(unit.name)}</option>)}</SelectField>
      </div>
      <section className="notion-import-panel" aria-labelledby="notion-import-title">
        <h2 id="notion-import-title">Importação direta do Notion</h2><p>Lê somente o espaço autorizado e não grava dados durante a pré-validação.</p>
        <button className="btn secondary" type="button" disabled={notionBusy} onClick={(event) => void runNotion(event.currentTarget.closest("form") as HTMLFormElement, true)}>{notionBusy ? "Lendo o Notion…" : "Conectar e pré-validar Notion"}</button>
        {notionValidated && <button className="btn primary" type="button" disabled={notionBusy} onClick={(event) => void runNotion(event.currentTarget.closest("form") as HTMLFormElement, false)}>Importar válidos do Notion</button>}
      </section>
      <TextField label="Arquivo CSV" type="file" accept=".csv,text/csv" onChange={(event) => void choose(event)} required />
      <SelectField label="Tipo de informação" value={entity} onChange={(event) => setEntity(event.target.value)}>{entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <p>{rows.length} linhas carregadas.</p>
      <div className="title-actions"><button className="btn secondary" type="submit" disabled={!rows.length}>Pré-validar</button><button className="btn primary" type="button" disabled={!preview} onClick={(event) => void run({ preventDefault() {}, currentTarget: event.currentTarget.closest("form") as HTMLFormElement } as FormEvent<HTMLFormElement>, false)}>Importar válidos</button></div>
      {preview && <div className="environment-warning">Aceitos: {String(preview.accepted ?? preview.imported ?? preview.total ?? 0)} · Rejeitados: {Array.isArray(preview.rejected) ? preview.rejected.length : 0}</div>}
    </form>
    <section className="card table-card operational-data-table"><div className="table-toolbar"><h2>Histórico de lotes</h2><span>{batches.length} registros</span></div>{batches.map((batch) => <div className="operational-row" key={batch.id}><div><strong>{String(batch.filename ?? "Importação")}</strong><small>{String(batch.status ?? "—")} · {String(batch.created_at ?? "")}</small></div>{!batch.rollback_at && <button type="button" onClick={() => void rollbackBatch(batch.id)}>Rollback</button>}</div>)}{!batches.length && <div className="empty-state">Nenhum registro cadastrado.</div>}</section>
  </div>;
}
