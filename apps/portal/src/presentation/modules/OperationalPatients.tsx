import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { FormSection, TextareaField, TextField } from "../components/FormPrimitives";
import { Row, groupSlotLabel, messageOf, value, useDialogFocus, useResources, Select, DrawerForm, ModuleState, EditableOperationalTable } from "./OperationalShared";

export function OperationalPatients({ canEdit = true, canViewEnrollments = true, canEditEnrollments = true, canViewAgenda = true, canEditAgenda = true, canViewTimeline = true }: { canEdit?: boolean; canViewEnrollments?: boolean; canEditEnrollments?: boolean; canViewAgenda?: boolean; canEditAgenda?: boolean; canViewTimeline?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const pageSize = 20;
  const includeOperational = canViewEnrollments || canViewAgenda;
  const patientPath = `/patients?page=${page}&pageSize=${pageSize}${appliedSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ""}${includeOperational ? "&includeOperational=true" : ""}`;
  const paths = [
    patientPath,
    "/units",
    ...(canViewEnrollments ? ["/plans"] : []),
    ...(canViewAgenda ? ["/group-slots"] : []),
  ];
  const { data, loading, error, reload } = useResources(paths);
  const plans: Row[] = data["/plans"] ?? [];
  const groupSlots: Row[] = data["/group-slots"] ?? [];
  const patients: Row[] = data[patientPath]?.items ?? [];
  const total = Number(data[patientPath]?.total ?? 0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{
    responsibles: Row[];
    consents: Row[];
    timeline?: Row;
  }>({ responsibles: [], consents: [] });
  const [notice, setNotice] = useState("");
  const [detailDirty, setDetailDirty] = useState(false);
  function closePatientDetails() {
    if (detailDirty && !window.confirm("Descartar os dados do responsável ainda não salvos?")) return;
    setDetailDirty(false);
    setSelected(null);
  }
  const patientDialogRef = useDialogFocus(Boolean(selected), closePatientDetails);
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const address = {
      street: value(f, "street"),
      number: value(f, "number"),
      city: value(f, "city"),
      state: value(f, "state"),
      zip: value(f, "zip"),
    };
    try {
      await api("/patients", {
        method: "POST",
        body: JSON.stringify({
          primary_unit_id: value(f, "primary_unit_id"),
          name: value(f, "name"),
          cpf: value(f, "cpf") || undefined,
          birth_date: value(f, "birth_date") || undefined,
          phone: value(f, "phone") || undefined,
          email: value(f, "email") || undefined,
          address,
          tax_data: {
            fiscal_name: value(f, "fiscal_name"),
            document: value(f, "fiscal_document"),
          },
          notes: value(f, "notes") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Paciente cadastrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function open(row: Row) {
    setDetailDirty(false);
    setSelected(row);
    try {
      const [responsibles, consents, timeline] = await Promise.all([
        api<Row[]>(`/patients/${row.id}/responsibles`),
        api<Row[]>(`/patients/${row.id}/consents`),
        canViewTimeline ? api<Row>(`/patients/${row.id}/timeline`) : Promise.resolve({ data: undefined }),
      ]);
      setDetail({
        responsibles: responsibles.data ?? [],
        consents: consents.data ?? [],
        timeline: timeline.data ?? undefined,
      });
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function responsible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const f = new FormData(event.currentTarget);
    try {
      await api(`/patients/${selected.id}/responsibles`, {
        method: "POST",
        body: JSON.stringify({
          name: value(f, "name"),
          relationship: value(f, "relationship"),
          cpf: value(f, "cpf") || undefined,
          phone: value(f, "phone") || undefined,
          email: value(f, "email") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      setDetailDirty(false);
      await open(selected);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function consent(kind: string, granted: boolean) {
    if (!selected) return;
    const purposes: Record<string, string> = {
      whatsapp: "Contato operacional pelo WhatsApp",
      data_processing: "Registro de ciência sobre o tratamento de dados",
    };
    try {
      await api(`/patients/${selected.id}/consents`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          granted,
          purpose: purposes[kind] ?? kind,
          legal_basis:
            kind === "whatsapp" ? "consent" : "healthcare_and_legal_obligation",
          notice_version: "1.0",
          source: "portal",
        }),
      });
      await open(selected);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function updatePatient(row: Row, form: FormData) {
    const enrollment = row.enrollment as Row | undefined;
    const planId = value(form, "plan_id");
    const groupSlotId = value(form, "group_slot_id");
    if (!enrollment && ((canEditEnrollments && planId) || (canEditAgenda && groupSlotId))) throw new Error("Este paciente ainda não possui matrícula ativa. Crie a matrícula antes de definir plano ou turma.");
    await api(`/patients/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        primary_unit_id: value(form, "primary_unit_id"), name: value(form, "name"),
        cpf: value(form, "cpf") || undefined, birth_date: value(form, "birth_date") || undefined,
        phone: value(form, "phone") || undefined, email: value(form, "email") || undefined,
        address: { street: value(form, "street"), number: value(form, "number"), city: value(form, "city"), state: value(form, "state"), zip: value(form, "zip") },
        tax_data: { fiscal_name: value(form, "fiscal_name"), document: value(form, "fiscal_document") },
        notes: value(form, "notes") || undefined,
      }),
    });
    if (!enrollment) return;
    if (canEditEnrollments && planId && planId !== enrollment.plan_id) {
      await api(`/enrollments/${enrollment.id}`, { method: "PATCH", body: JSON.stringify({ plan_id: planId }) });
    }
    if (!canEditAgenda) return;
    const membership = row.membership as Row | undefined;
    if (membership && !groupSlotId) {
      await api(`/group-slot-memberships/${membership.id}`, { method: "DELETE" });
    } else if (groupSlotId && groupSlotId !== membership?.group_slot_id) {
      if (membership) {
        await api(`/group-slot-memberships/${membership.id}`, { method: "PATCH", body: JSON.stringify({ group_slot_id: groupSlotId, starts_at: membership.starts_at, ends_at: membership.ends_at || undefined }) });
      } else {
        await api(`/group-slots/${groupSlotId}/members`, { method: "POST", body: JSON.stringify({ enrollment_id: enrollment.id, patient_id: row.id, starts_at: enrollment.starts_at, ends_at: enrollment.ends_at || undefined }) });
      }
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">CADASTRO COMPLETO</p>
          <h1>Pacientes</h1>
          <p>
            Dados pessoais, fiscais, responsável, consentimentos e linha do
            tempo.
          </p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <form className="card patient-search" role="search" onSubmit={submitSearch}>
        <div>
          <TextField id="patient-search-input" label="Buscar pacientes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone ou CPF" />
          <button className="btn primary">Buscar</button>
          {appliedSearch && <button type="button" className="btn secondary" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }}>Limpar</button>}
        </div>
      </form>
      {canEdit && <DrawerForm title="Novo paciente" onSubmit={create}>
        <h2>Novo paciente</h2>
        <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
        <FormSection legend="Identificação e contato">
          <div className="form-row">
            <TextField name="name" label="Nome completo" autoComplete="name" required />
            <Select name="primary_unit_id" label="Unidade principal" rows={data["/units"] ?? []} />
          </div>
          <div className="form-row">
            <TextField name="cpf" label="CPF" inputMode="numeric" placeholder="000.000.000-00" />
            <TextField name="birth_date" label="Nascimento" type="date" autoComplete="bday" />
          </div>
          <div className="form-row">
            <TextField name="phone" label="Telefone" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" />
            <TextField name="email" label="E-mail" type="email" autoComplete="email" />
          </div>
        </FormSection>
        <FormSection legend="Endereço">
          <div className="form-row">
            <TextField name="street" label="Rua" autoComplete="street-address" />
            <TextField name="number" label="Número" inputMode="numeric" />
          </div>
          <div className="form-row">
            <TextField name="city" label="Cidade" autoComplete="address-level2" />
            <TextField name="state" label="Estado" maxLength={2} autoComplete="address-level1" />
          </div>
          <TextField name="zip" label="CEP" inputMode="numeric" autoComplete="postal-code" />
        </FormSection>
        <FormSection legend="Dados fiscais">
          <div className="form-row">
            <TextField name="fiscal_name" label="Nome fiscal" />
            <TextField name="fiscal_document" label="Documento fiscal" />
          </div>
        </FormSection>
        <TextareaField name="notes" label="Observações" rows={3} />
        <button className="btn primary">Cadastrar paciente</button>
      </DrawerForm>}
      <EditableOperationalTable
        title="Pacientes cadastrados"
        resource="patients"
        rows={patients}
        emptyMessage={appliedSearch ? "Nenhum paciente corresponde à busca. Revise o nome, telefone ou CPF." : "Nenhum paciente foi cadastrado nesta unidade."}
        fields={["name", "phone", "email", "plan_name", "group_name", "active"]}
        editFields={[
          { name: "name", label: "Nome completo", required: true },
          { name: "primary_unit_id", label: "Unidade principal", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "cpf", label: "CPF" },
          { name: "birth_date", label: "Nascimento", type: "date" },
          { name: "phone", label: "Telefone", type: "tel" },
          { name: "email", label: "E-mail", type: "email" },
          ...(canEditEnrollments ? [{ name: "plan_id", label: "Plano atual", type: "select" as const, options: plans.filter((item) => item.active !== false), value: (row: Row) => row.enrollment?.plan_id }] : []),
          ...(canEditAgenda ? [{ name: "group_slot_id", label: "Turma atual (opcional)", type: "select" as const, options: groupSlots.filter((item) => item.active !== false).map((item) => ({ ...item, name: `${groupSlotLabel(item)} · ${(data["/units"] ?? []).find((unit: Row) => unit.id === item.unit_id)?.name ?? "Unidade"}` })), value: (row: Row) => row.membership?.group_slot_id }] : []),
          { name: "street", label: "Rua", value: (row) => row.address?.street },
          { name: "number", label: "Número", value: (row) => row.address?.number },
          { name: "city", label: "Cidade", value: (row) => row.address?.city },
          { name: "state", label: "Estado", value: (row) => row.address?.state, maxLength: 2 },
          { name: "zip", label: "CEP", value: (row) => row.address?.zip },
          { name: "fiscal_name", label: "Nome fiscal", value: (row) => row.tax_data?.fiscal_name },
          { name: "fiscal_document", label: "Documento fiscal", value: (row) => row.tax_data?.document },
          { name: "notes", label: "Observações", type: "textarea" },
        ]}
        buildBody={(form) => ({
          primary_unit_id: value(form, "primary_unit_id"),
          name: value(form, "name"),
          cpf: value(form, "cpf") || undefined,
          birth_date: value(form, "birth_date") || undefined,
          phone: value(form, "phone") || undefined,
          email: value(form, "email") || undefined,
          address: {
            street: value(form, "street"), number: value(form, "number"),
            city: value(form, "city"), state: value(form, "state"), zip: value(form, "zip"),
          },
          tax_data: { fiscal_name: value(form, "fiscal_name"), document: value(form, "fiscal_document") },
          notes: value(form, "notes") || undefined,
        })}
        saveRow={updatePatient}
        onChanged={reload}
        onNotice={setNotice}
        onOpen={open}
        allowDelete
        canEdit={canEdit}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePatientDetails();
        }}>
          <section
            ref={patientDialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-dialog-title"
            tabIndex={-1}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">PACIENTE</p>
                <h2 id="patient-dialog-title">{selected.name}</h2>
                <p>{selected.cpf ?? "CPF não informado"}</p>
              </div>
              <button type="button" aria-label="Fechar detalhes do paciente" onClick={closePatientDetails}>×</button>
            </div>
            <div className="modal-form">
              <h3>Consentimentos</h3>
              {canEdit && <div className="row-actions">
                <button onClick={() => consent("whatsapp", true)}>
                  Autorizar contato
                </button>
                <button onClick={() => consent("whatsapp", false)}>
                  Revogar contato
                </button>
                <button onClick={() => consent("data_processing", true)}>
                  Autorizar tratamento de dados
                </button>
              </div>}
              <p>{detail.consents.length} registros de consentimento.</p>
              {canEdit && <form onSubmit={responsible} onInput={() => setDetailDirty(true)}>
                <h3>Adicionar responsável</h3>
                <div className="form-row">
                  <TextField name="name" label="Nome" required />
                  <TextField name="relationship" label="Relação" />
                </div>
                <div className="form-row">
                  <TextField name="cpf" label="CPF" />
                  <TextField name="phone" label="Telefone" />
                </div>
                <TextField name="email" label="E-mail" type="email" />
                <button className="btn primary">Salvar responsável</button>
              </form>}
              <h3>Linha do tempo</h3>
              <p>
                {detail.timeline?.appointments?.length ?? 0} atendimentos ·{" "}
                {detail.timeline?.records?.length ?? 0} registros clínicos ·{" "}
                {detail.timeline?.charges?.length ?? 0} cobranças
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
