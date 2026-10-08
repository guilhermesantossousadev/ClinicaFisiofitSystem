import { FormEvent, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { FormSection, TextareaField, TextField } from "../components/FormPrimitives";
import { Row, messageOf, value, useDialogFocus, useResources, Select, DrawerForm, ModuleState, EditableOperationalTable } from "./OperationalShared";

export function OperationalPatients({ canEdit = true, canViewEnrollments = true, canViewAgenda = true, canViewTimeline = true }: { canEdit?: boolean; canViewEnrollments?: boolean; canEditEnrollments?: boolean; canViewAgenda?: boolean; canEditAgenda?: boolean; canViewTimeline?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const pageSize = 20;
  const includeOperational = canViewEnrollments || canViewAgenda;
  const patientPath = `/patients?page=${page}&pageSize=${pageSize}${appliedSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ""}${includeOperational ? "&includeOperational=true" : ""}`;
  const paths = [
    patientPath,
    "/units",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const patients: Row[] = data[patientPath]?.items ?? [];
  const total = Number(data[patientPath]?.total ?? 0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{
    responsibles: Row[];
    consents: Row[];
    timeline?: Row;
  }>({ responsibles: [], consents: [] });
  const detailRequest = useRef(0);
  const [notice, setNotice] = useState("");
  const [detailDirty, setDetailDirty] = useState(false);
  function closePatientDetails() {
    if (detailDirty && !window.confirm("Descartar os dados do responsável ainda não salvos?")) return;
    setDetailDirty(false);
    detailRequest.current += 1;
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
    const form = event.currentTarget;
    const f = new FormData(form);
    const address = {
      street: value(f, "street"),
      number: value(f, "number"),
      neighborhood: value(f, "neighborhood"),
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
          cpf: value(f, "cpf") || null,
          birth_date: value(f, "birth_date") || null,
          phone: value(f, "phone") || null,
          email: value(f, "email") || null,
          address,
          tax_data: {
            fiscal_name: value(f, "fiscal_name"),
            document: value(f, "fiscal_document"),
          },
          notes: value(f, "notes") || null,
        }),
      });
      form.reset();
      await reload();
      setNotice("Paciente cadastrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function open(row: Row) {
    const request = ++detailRequest.current;
    setDetailDirty(false);
    setDetail({ responsibles: [], consents: [] });
    setSelected(row);
    try {
      const [responsibles, consents, timeline] = await Promise.all([
        api<Row[]>(`/patients/${row.id}/responsibles`),
        api<Row[]>(`/patients/${row.id}/consents`),
        canViewTimeline ? api<Row>(`/patients/${row.id}/timeline`) : Promise.resolve({ data: undefined }),
      ]);
      if (request !== detailRequest.current) return;
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
    const form = event.currentTarget;
    const f = new FormData(form);
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
      form.reset();
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
        {notice && <p role="status">{notice}</p>}
        <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
        <FormSection legend="Identificação e contato">
          <div className="form-row">
            <TextField name="name" label="Nome completo" autoComplete="name" minLength={3} maxLength={160} required />
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
          <TextField name="neighborhood" label="Bairro" autoComplete="address-level3" />
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
        <TextareaField name="notes" label="Observações" rows={3} maxLength={4000} />
        <button className="btn primary">Cadastrar paciente</button>
      </DrawerForm>}
      <EditableOperationalTable
        title="Pacientes cadastrados"
        resource="patients"
        rows={patients}
        emptyMessage={appliedSearch ? "Nenhum paciente corresponde à busca. Revise o nome, telefone ou CPF." : "Nenhum paciente foi cadastrado nesta unidade."}
        fields={["name", "phone", "email", "plan_name", "group_name", "active"]}
        editFields={[
          { name: "name", label: "Nome completo", required: true, minLength: 3, maxLength: 160 },
          { name: "primary_unit_id", label: "Unidade principal", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "cpf", label: "CPF" },
          { name: "birth_date", label: "Nascimento", type: "date" },
          { name: "phone", label: "Telefone", type: "tel" },
          { name: "email", label: "E-mail", type: "email" },
          { name: "street", label: "Rua", value: (row) => row.address?.street },
          { name: "number", label: "Número", value: (row) => row.address?.number },
          { name: "neighborhood", label: "Bairro", value: (row) => row.address?.neighborhood },
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
          cpf: value(form, "cpf") || null,
          birth_date: value(form, "birth_date") || null,
          phone: value(form, "phone") || null,
          email: value(form, "email") || null,
          address: {
            street: value(form, "street"), number: value(form, "number"), neighborhood: value(form, "neighborhood"),
            city: value(form, "city"), state: value(form, "state"), zip: value(form, "zip"),
          },
          tax_data: { fiscal_name: value(form, "fiscal_name"), document: value(form, "fiscal_document") },
          notes: value(form, "notes") || null,
        })}
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
                {notice && <p role="status">{notice}</p>}
                <div className="form-row">
                  <TextField name="name" label="Nome" minLength={3} maxLength={160} required />
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
