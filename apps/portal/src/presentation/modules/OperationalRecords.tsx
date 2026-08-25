import { FormEvent, useCallback, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { supabase } from "../../infrastructure/supabase/client";
import { CheckboxField, SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { Row, messageOf, value, useResources, Select, DrawerForm, ModuleState } from "./OperationalShared";

export function OperationalRecords({ canEdit = true }: { canEdit?: boolean }) {
  const basePaths = [
    "/patients?page=1&pageSize=100",
    "/professionals",
    "/units",
    "/record-templates",
  ];
  const { data, loading, error, reload } = useResources(basePaths);
  const patients = data[basePaths[0]]?.items ?? [];
  const [patientId, setPatientId] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const [draftKind, setDraftKind] = useState<"assessment" | "evolution">("assessment");
  const loadRecords = useCallback(async (id: string) => {
    setPatientId(id);
    if (!id) return setRecords([]);
    try {
      const [recordResponse, attachmentResponse] = await Promise.all([
        api<Row[]>(`/clinical-records?patientId=${id}`),
        api<Row[]>(`/attachments?patientId=${id}`),
      ]);
      setRecords(recordResponse.data ?? []);
      setAttachments(attachmentResponse.data ?? []);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }, []);
  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !patientId) return;
    try {
      const response = await api<Row>("/attachments/upload-url", { method: "POST", body: JSON.stringify({
        patient_id: patientId, entity_type: "patient", entity_id: patientId, filename: file.name,
        content_type: file.type, size_bytes: file.size,
      }) });
      if (!response.data) throw new Error("Não foi possível preparar o upload.");
      const upload = await supabase.storage.from("clinical-files").uploadToSignedUrl(response.data.path, response.data.token, file);
      if (upload.error) throw upload.error;
      await loadRecords(patientId);
      setNotice("Anexo enviado.");
    } catch (e) { setNotice(messageOf(e)); }
    event.target.value = "";
  }
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      (event.target as HTMLFormElement).reset();
      setDraftKind("assessment");
      await loadRecords(patientId);
      setNotice("Registro clínico salvo como rascunho.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function sign(id: string) {
    try {
      await api(`/clinical-records/${id}/sign`, {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
      });
      await loadRecords(patientId);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function rectify(id: string) {
    const reason = window.prompt(
      "Justificativa da retificação (mínimo 10 caracteres):",
    );
    const text = window.prompt("Texto corrigido:");
    if (!reason || !text) return;
    try {
      await api(`/clinical-records/${id}/rectify`, {
        method: "POST",
        body: JSON.stringify({ reason, payload: { text } }),
      });
      await loadRecords(patientId);
    } catch (e) {
      setNotice(messageOf(e));
    }
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
      <SelectField className="card record-selector" label="Paciente" value={patientId} onChange={(e) => loadRecords(e.target.value)}>
          <option value="">Selecione</option>
          {patients.map((row: Row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
      </SelectField>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {patientId && canEdit && (
        <DrawerForm title="Novo registro" onSubmit={createRecord}>
          <h2>Novo registro</h2>
          <div className="form-row">
            <SelectField name="kind" label="Tipo de registro" value={draftKind} onChange={(event) => setDraftKind(event.target.value as "assessment" | "evolution")}>
              <option value="assessment">Avaliação inicial</option><option value="evolution">Evolução</option>
            </SelectField>
            <Select
              name="template_id"
              label="Modelo (opcional)"
              rows={data["/record-templates"] ?? []}
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
          <button className="btn primary">Salvar rascunho</button>
        </DrawerForm>
      )}
      {patientId && <section className="card table-card">
        <div className="table-toolbar"><h2>Anexos do paciente</h2>{canEdit && <label className="btn secondary">Adicionar arquivo<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={uploadAttachment} /></label>}</div>
        {attachments.map((file) => <div className="operational-row" key={file.id}><div><strong>{file.filename}</strong><small>{file.content_type} · {Math.round(file.size_bytes / 1024)} KB</small></div></div>)}
        {!attachments.length && <div className="empty-state">Nenhum anexo.</div>}
      </section>}
      <section className="card table-card bespoke-table records-list-table">
        <div className="table-toolbar"><h2>Registros clínicos</h2><span>{records.length} registros</span></div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Tipo e status</span><span>Data e conteúdo</span><span>Ações</span></div>
        {records.map((row) => (
          <div className="operational-row" key={row.id}>
            <div>
              <strong>
                {row.kind === "assessment" ? "Avaliação inicial" : "Evolução"} · {row.status === "draft" ? "Rascunho" : row.status === "signed" ? "Assinado" : row.status}
              </strong>
              <small>
                {new Date(row.created_at).toLocaleString("pt-BR")} · {row.payload?.complaint || row.payload?.text || row.payload?.functional_diagnosis || "Sem descrição"}
              </small>
            </div>
            <div className="row-actions">
              {canEdit && row.status === "draft" && (
                <button onClick={() => sign(row.id)}>Assinar</button>
              )}
              {canEdit && row.status === "signed" && (
                <button onClick={() => rectify(row.id)}>Retificar</button>
              )}
            </div>
          </div>
        ))}
        {patientId && !records.length && (
          <div className="empty-state">Paciente sem registros clínicos.</div>
        )}
      </section>
    </div>
  );
}
