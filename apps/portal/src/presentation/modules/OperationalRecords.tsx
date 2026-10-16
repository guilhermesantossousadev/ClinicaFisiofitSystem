import { requestText, confirmAction } from '../components/Decisions';
import { Notice, Tabs } from "@fisiofit/design-system/react";
import { DetailPanel, Facts, RelatedActions, SectionIntro, useModuleState, useWorkspace } from "../components/ModuleWorkspace";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { supabase } from "../../infrastructure/supabase/client";
import { CheckboxField, SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { Row, messageOf, statusLabel, value, useResources, Select, DrawerForm, ModuleState, PatientPicker } from "./OperationalShared";

export function OperationalRecords({ canEdit = true }: { canEdit?: boolean }) {
  const workspace = useWorkspace();
  const contextPatient = workspace?.journey?.patient;
  const basePaths = [
    "/patients?page=1&pageSize=100",
    "/professionals",
    "/units",
    "/record-templates",
  ];
  const { data, loading, error, reload } = useResources(basePaths);
  const patients = data[basePaths[0]]?.items ?? [];
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [recordTab, setRecordTab] = useModuleState("records.tab", "all");
  const [recordQuery, setRecordQuery] = useModuleState("records.query", "");
  const [openedRecord, setOpenedRecord] = useState<Row | null>(null);
  const [records, setRecords] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const [draftKind, setDraftKind] = useState<"assessment" | "evolution">("assessment");
  const selectionVersion = useRef(0);
  const selectedPatient = useRef("");
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { selectionVersion.current += 1; }, []);
  const loadRecords = useCallback(async (id: string) => {
    const version = ++selectionVersion.current;
    selectedPatient.current = id;
    setRecords([]); setAttachments([]); setNotice(""); setRecordsError("");
    setRecordsLoading(Boolean(id));
    setPatientId(id);
    if (!id) return;
    try {
      const [recordResponse, attachmentResponse] = await Promise.all([
        api<Row[]>(`/clinical-records?patientId=${id}`),
        api<Row[]>(`/attachments?patientId=${id}`),
      ]);
      if (version !== selectionVersion.current) return;
      setRecords(recordResponse.data ?? []);
      setAttachments(attachmentResponse.data ?? []);
    } catch (e) {
      if (version === selectionVersion.current) setRecordsError(messageOf(e));
    } finally { if (version === selectionVersion.current) setRecordsLoading(false); }
  }, []);
  useEffect(() => { if (contextPatient) { setPatientName(contextPatient.name); void loadRecords(contextPatient.id); } }, [contextPatient?.id, loadRecords]);
  async function openAttachment(id: string) {
    // Open the window during the user gesture so popup blockers allow it.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const version = selectionVersion.current;
    try {
      const result = await api<{ signedUrl: string }>(`/attachments/${id}/download-url`);
      if (version !== selectionVersion.current) { popup?.close(); return; }
      if (!result.data?.signedUrl) throw new Error("O arquivo não está disponível.");
      if (popup) popup.location.href = result.data.signedUrl;
      else setNotice("Permita abrir uma nova aba para visualizar o arquivo.");
    } catch (e) { popup?.close(); if (version === selectionVersion.current) setNotice(messageOf(e)); }
  }
  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !patientId || busy) return;
    const targetPatient = patientId; const version = selectionVersion.current; setBusy(true);
    let attachmentId = "";
    try {
      const response = await api<Row>("/attachments/upload-url", { method: "POST", body: JSON.stringify({
        patient_id: patientId, entity_type: "patient", entity_id: patientId, filename: file.name,
        content_type: file.type, size_bytes: file.size,
      }) });
      attachmentId = response.data?.attachment?.id ?? "";
      if (!response.data) throw new Error("Não foi possível preparar o upload.");
      const upload = await supabase.storage.from("clinical-files").uploadToSignedUrl(response.data.path, response.data.token, file);
      if (upload.error) throw upload.error;
      if (selectedPatient.current === targetPatient) { await loadRecords(targetPatient); setNotice("Anexo enviado."); }
    } catch (e) {
      if (attachmentId) await api(`/attachments/${attachmentId}`, { method: "DELETE" }).catch(() => {});
      if (version === selectionVersion.current) setNotice(messageOf(e));
    } finally { setBusy(false); }
    event.target.value = "";
  }
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || recordsLoading) return;
    const targetPatient = patientId; setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/clinical-records", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          professional_id: value(form, "professional_id"),
          unit_id: value(form, "unit_id"),
          kind: value(form, "kind"),
          template_id: value(form, "template_id") || undefined,
          payload: {
            text: value(form, "text"),
            measures: value(form, "measures"),
            complaint: value(form, "complaint"),
            current_history: value(form, "current_history"),
            previous_history: value(form, "previous_history"),
            exam: value(form, "exam"),
            exam_detail: value(form, "exam_detail"),
            functional_diagnosis: value(form, "functional_diagnosis"),
            treatment_plan: value(form, "treatment_plan"),
            goals: value(form, "goals"),
            exercises: Array.from(form.getAll("exercise")).map(String),
            observations: value(form, "observations"),
          },
        }),
      });
      if (selectedPatient.current !== targetPatient) return;
      formElement.reset();
      setDraftKind("assessment");
      if (selectedPatient.current === targetPatient) await loadRecords(targetPatient);
      setNotice("Registro clínico salvo como rascunho.");
    } catch (e) {
      if (selectedPatient.current === targetPatient) setNotice(messageOf(e));
    } finally { setBusy(false); }
  }
  async function sign(id: string) {
    if (busy) return;
    if (!await confirmAction("Assinar este registro clínico? Após a assinatura, o conteúdo só poderá ser corrigido por uma retificação com justificativa.", { confirmLabel: "Assinar registro clínico", destructive: false })) return;
    setBusy(true);
    const targetPatient = patientId;
    try {
      await api(`/clinical-records/${id}/sign`, {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
      });
      if (selectedPatient.current === targetPatient) { await loadRecords(targetPatient); setNotice("Registro clínico assinado."); }
    } catch (e) {
      setNotice(messageOf(e));
    } finally { setBusy(false); }
  }
  async function rectify(id: string) {
    if (busy) return;
    const targetPatient = patientId;
    const reason = await requestText(
      "Justificativa da retificação (mínimo 10 caracteres):",
    );
    if (!reason) return;
    const text = await requestText("Texto corrigido:");
    if (!text) return;
    setBusy(true);
    try {
      await api(`/clinical-records/${id}/rectify`, {
        method: "POST",
        body: JSON.stringify({ reason, payload: { text } }),
      });
      if (selectedPatient.current === targetPatient) { await loadRecords(targetPatient); setNotice("Retificação registrada."); }
    } catch (e) {
      setNotice(messageOf(e));
    } finally { setBusy(false); }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">PRONTUÁRIO ELETRÔNICO</p>
          <h1>Avaliações e evoluções</h1>
          <p>
            Registros assinados são imutáveis; correções geram retificações.
          </p>
        </div>
        <div className="record-header-note"><span>Fluxo clínico</span><strong>Avaliação inicial + evoluções</strong></div>
      </div>
      <div className="card record-selector"><PatientPicker key={contextPatient?.id ?? "manual"} rows={patients} crossUnit defaultValue={contextPatient?.id} defaultLabel={contextPatient?.name} label="Buscar paciente" onSelect={(patient) => { setPatientName(patient.name); setOpenedRecord(null); void loadRecords(patient.id); }} onClear={() => { setPatientName(""); setOpenedRecord(null); void loadRecords(""); }} /></div>
      {!patientId && <SectionIntro title="Comece pelo paciente">Pesquise e selecione a pessoa para consultar o histórico, adicionar um registro ou abrir os anexos autorizados.</SectionIntro>}
      {patientId && <section className="patient-workspace-heading"><div className="patient-monogram" aria-hidden="true">{patientName.slice(0, 1)}</div><div><p className="eyebrow">PRONTUÁRIO DO PACIENTE</p><h2>{patientName}</h2><p>Acesso clínico restrito à equipe autorizada.</p></div><RelatedActions patient={{id:patientId,name:patientName}} exclude="Prontuários" /></section>}
      {notice && (
        <Notice message={notice} onDismiss={() => setNotice("")} />
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {patientId && canEdit && !recordsLoading && !recordsError && (
        <DrawerForm key={patientId} title="Novo registro" onSubmit={createRecord}>
          <h2>Novo registro</h2>
          <div className="form-row">
            <SelectField name="kind" label="Tipo de registro" value={draftKind} onChange={(event) => setDraftKind(event.target.value as "assessment" | "evolution")}>
              <option value="assessment">Avaliação inicial</option><option value="evolution">Evolução</option>
            </SelectField>
            <Select
              name="template_id"
              label="Modelo (opcional)"
              rows={(data["/record-templates"] ?? []).filter((row: Row) => row.active !== false)}
              required={false}
            />
          </div>
          <div className="form-row">
            <Select
              name="professional_id"
              label="Profissional"
              rows={data["/professionals"] ?? []}
            />
            <Select
              name="unit_id"
              label="Unidade"
              rows={data["/units"] ?? []}
            />
          </div>
          {draftKind === "assessment" ? <>
            <fieldset className="clinical-fieldset"><legend>Dados da avaliação</legend>
              <div className="form-row"><TextareaField name="text" label="Diagnóstico clínico" rows={2} /><TextareaField name="complaint" label="Queixa principal" rows={2} required /></div>
              <TextareaField name="current_history" label="História da moléstia atual" rows={3} />
              <TextareaField name="previous_history" label="História pregressa" rows={3} />
              <div className="form-row"><TextField name="measures" label="Peso / altura / sinais vitais" placeholder="Peso · Altura · PA · FC · FR" /><TextareaField name="exam" label="Encurtamentos" rows={2} /></div>
              <TextareaField name="exam_detail" label="Força muscular e exame físico" rows={3} />
              <TextareaField name="functional_diagnosis" label="Diagnóstico funcional" rows={3} />
              <TextareaField name="treatment_plan" label="Plano de tratamento" rows={3} />
            </fieldset>
          </> : <>
            <fieldset className="clinical-fieldset"><legend>Evolução da sessão</legend>
              <TextareaField name="text" label="Evolução" rows={3} required placeholder="Como o paciente chegou, queixas e resposta ao atendimento…" />
              <div className="exercise-grid" aria-label="Focos trabalhados"><span>Foco da sessão</span>{["Alongamento", "Fortalecimento", "Mobilidade", "Ex. postural", "Equilíbrio", "Outro"].map((item) => <CheckboxField key={item} label={item} name="exercise" value={item} />)}</div>
              <TextareaField name="observations" label="Observações e conduta" rows={4} placeholder="Descreva exercícios, orientações e próximos passos…" />
            </fieldset>
          </>}
          <button className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Salvar rascunho"}</button>
        </DrawerForm>
      )}
      <ModuleState loading={recordsLoading} error={recordsError} retry={() => void loadRecords(patientId)} />
      {patientId && !recordsLoading && !recordsError && <section className="card table-card">
        <div className="table-toolbar"><h2>Anexos do paciente</h2>{canEdit && <label className="btn secondary">Adicionar arquivo<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadAttachment} /></label>}</div>
        {attachments.map((file) => <div className="operational-row" key={file.id}><div><strong>{file.filename}</strong><small>{file.content_type} · {Math.round(file.size_bytes / 1024)} KB</small></div><button type="button" className="btn secondary" onClick={() => void openAttachment(file.id)}>Abrir arquivo</button></div>)}
        {!attachments.length && <div className="empty-state">Nenhum anexo foi adicionado para este paciente.</div>}
      </section>}
      {patientId && !recordsLoading && !recordsError && <section className="card table-card records-list-table clinical-workspace">
        <div className="table-toolbar"><h2>Registros clínicos</h2><span>{records.length} registros</span></div>
        <div className="collection-toolbar"><Tabs id="clinical-records" label="Filtrar registros clínicos" value={recordTab} onChange={setRecordTab} items={[{value:"all",label:"Todos"},{value:"assessment",label:"Avaliações"},{value:"evolution",label:"Evoluções"},{value:"draft",label:"Rascunhos"},{value:"signed",label:"Assinados"}]} /><TextField label="Pesquisar no histórico clínico" type="search" value={recordQuery} onChange={event => setRecordQuery(event.target.value)} /></div>
        <div role="tabpanel" id={`clinical-records-panel-${recordTab}`} aria-labelledby={`clinical-records-${recordTab}`} tabIndex={0}>
        {records.filter(row => (recordTab === "all" || row.kind === recordTab || row.status === recordTab) && (!recordQuery.trim() || Object.values(row.payload ?? {}).flat().join(' ').toLocaleLowerCase('pt-BR').includes(recordQuery.trim().toLocaleLowerCase('pt-BR')))).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).map((row) => (
          <article className="clinical-timeline-entry" key={row.id}>
            <div>
              <div className="clinical-entry-heading"><strong>{row.kind === "assessment" ? "Avaliação inicial" : row.kind === "rectification" ? "Retificação" : "Evolução"}</strong><span className={`status ${row.status === 'signed' ? 'success' : 'neutral'}`}>{statusLabel(row.status)}</span></div>
              <small>{new Date(row.created_at).toLocaleString("pt-BR", { timeZone:"America/Sao_Paulo" })} · {(data['/professionals'] ?? []).find((pro: Row) => pro.id === row.professional_id)?.name || "Profissional não informado"}</small>
              <p className="clinical-excerpt">{row.payload?.complaint || row.payload?.text || row.payload?.functional_diagnosis || "Sem descrição"}</p>
            </div>
            <div className="row-actions">
              <button className="btn secondary" type="button" onClick={() => setOpenedRecord(row)}>Ler registro completo</button>
              {canEdit && row.status === "draft" && (
                <button disabled={busy} onClick={() => void sign(row.id)}>{busy ? "Processando…" : "Assinar"}</button>
              )}
              {canEdit && row.status === "signed" && (
                <button disabled={busy} onClick={() => rectify(row.id)}>Retificar</button>
              )}
            </div>
          </article>
        ))}
        {records.length > 0 && !records.some(row => (recordTab === 'all' || row.kind === recordTab || row.status === recordTab) && (!recordQuery.trim() || Object.values(row.payload ?? {}).flat().join(' ').toLocaleLowerCase('pt-BR').includes(recordQuery.trim().toLocaleLowerCase('pt-BR')))) && <div className="empty-state"><strong>Nenhum registro corresponde aos filtros</strong><button className="btn secondary" onClick={() => { setRecordTab('all'); setRecordQuery(''); }}>Limpar filtros clínicos</button></div>}
        {patientId && !records.length && (
          <div className="empty-state">Este paciente ainda não possui avaliações ou evoluções registradas.</div>
        )}
        </div>
      </section>}
      {openedRecord && <DetailPanel title={openedRecord.kind === 'assessment' ? 'Avaliação inicial' : 'Registro clínico'} eyebrow={patientName} onClose={() => setOpenedRecord(null)} wide><Facts items={[["Situação", statusLabel(openedRecord.status)], ["Registrado em", new Date(openedRecord.created_at).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})], ["Profissional", (data['/professionals'] ?? []).find((pro: Row) => pro.id === openedRecord.professional_id)?.name], ["Unidade", (data['/units'] ?? []).find((unit: Row) => unit.id === openedRecord.unit_id)?.name]]} />{Object.entries(clinicalLabels).filter(([key]) => openedRecord.payload?.[key] && (!Array.isArray(openedRecord.payload[key]) || openedRecord.payload[key].length)).map(([key,label]) => <section className="clinical-narrative" key={key}><h3>{label}</h3><p>{Array.isArray(openedRecord.payload[key]) ? openedRecord.payload[key].join(', ') : String(openedRecord.payload[key])}</p></section>)}{openedRecord.signed_at && <p className="clinical-signature">Assinado em {new Date(openedRecord.signed_at).toLocaleString('pt-BR')}. Correções são registradas por retificação.</p>}</DetailPanel>}
    </div>
  );
}

const clinicalLabels: Record<string,string> = { text:'Registro / diagnóstico clínico', complaint:'Queixa principal', current_history:'História da moléstia atual', previous_history:'História pregressa', measures:'Medidas e sinais vitais', exam:'Encurtamentos', exam_detail:'Exame físico', functional_diagnosis:'Diagnóstico funcional', treatment_plan:'Plano de tratamento', goals:'Objetivos', exercises:'Focos trabalhados', observations:'Observações e conduta' };
