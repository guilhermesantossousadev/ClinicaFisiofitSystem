import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { CheckboxField, FormSection, SelectField, TextField } from "../components/FormPrimitives";
import { Row, Unit, messageOf, value, cents, useResources, Select, DrawerForm, ModuleState, EditableOperationalTable } from "./OperationalShared";

type AdministrationTab = "units" | "rooms" | "services" | "professionals" | "templates";
type AdministrationSectionProps = {
  data: Record<string, any>;
  reload: () => void | Promise<void>;
  setNotice: (message: string) => void;
  submit: (
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: (form: FormData) => Row,
  ) => Promise<void>;
  canDelete?: boolean;
  canEdit?: boolean;
};

function FormularioUnidade({ data, reload, setNotice, submit, canDelete = false, canEdit = true, canManageUnits = false }: AdministrationSectionProps & { canManageUnits?: boolean }) {
  return <div className="administration-section">
    {canManageUnits && <DrawerForm title="Nova unidade" className="administration-form" onSubmit={(event) => submit(event, "/units", (form) => ({
      name: value(form, "name"), phone: value(form, "phone") || undefined,
      address: { street: value(form, "street"), city: value(form, "city"), state: value(form, "state") },
    }))}>
      <h2>Nova unidade</h2>
      <p className="form-instructions">Cadastre os dados de identificação e localização da unidade.</p>
      <TextField name="name" label="Nome" required />
      <div className="form-row"><TextField name="phone" label="Telefone" type="tel" /><TextField name="street" label="Rua" /></div>
      <div className="form-row"><TextField name="city" label="Cidade" /><TextField name="state" label="Estado" maxLength={2} /></div>
      <button className="btn primary">Salvar unidade</button>
    </DrawerForm>}
    <EditableOperationalTable title="Unidades" resource="units" rows={data["/units"] ?? []} fields={["name", "phone", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "phone", label: "Telefone" }, { name: "street", label: "Rua", value: (row) => row.address?.street }, { name: "city", label: "Cidade", value: (row) => row.address?.city }, { name: "state", label: "Estado", value: (row) => row.address?.state, maxLength: 2 }]}
      buildBody={(form) => ({ name: value(form, "name"), phone: value(form, "phone") || null, address: { street: value(form, "street"), city: value(form, "city"), state: value(form, "state") } })}
      onChanged={reload} onNotice={setNotice} allowDelete={canDelete && canEdit} canEdit={canManageUnits && canEdit} />
  </div>;
}

function FormularioSala({ data, reload, setNotice, submit, canDelete = false, canEdit = true }: AdministrationSectionProps) {
  return <div className="administration-section">
    {canEdit && <DrawerForm title="Nova sala" className="administration-form" onSubmit={(event) => submit(event, "/rooms", (form) => ({ unit_id: value(form, "unit_id"), name: value(form, "name"), capacity: Number(value(form, "capacity")) }))}>
      <h2>Nova sala</h2><p className="form-instructions">Vincule a sala a uma unidade e informe sua capacidade.</p>
      <Select name="unit_id" label="Unidade *" rows={data["/units"] ?? []} />
      <TextField name="name" label="Nome" required />
      <TextField name="capacity" label="Capacidade" type="number" min="1" max="20" defaultValue="7" required />
      <button className="btn primary">Salvar sala</button>
    </DrawerForm>}
    <EditableOperationalTable title="Salas" resource="rooms" rows={data["/rooms"] ?? []} fields={["name", "capacity", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "capacity", label: "Capacidade", type: "number", min: 1, max: 20, required: true }]}
      buildBody={(form) => ({ name: value(form, "name"), capacity: Number(value(form, "capacity")) })} onChanged={reload} onNotice={setNotice} allowDelete={canDelete} canEdit={canEdit} />
  </div>;
}

function FormularioServico({ data, reload, setNotice, submit, canDelete = false, canEdit = true }: AdministrationSectionProps) {
  return <div className="administration-section">
    {canEdit && <DrawerForm title="Novo serviço" className="administration-form" onSubmit={(event) => submit(event, "/services", (form) => ({ name: value(form, "name"), duration_minutes: Number(value(form, "duration")), price_cents: cents(value(form, "price")), active: true }))}>
      <h2>Novo serviço</h2><p className="form-instructions">Defina duração e preço padrão do atendimento.</p>
      <TextField name="name" label="Nome" required />
      <div className="form-row"><TextField name="duration" label="Duração (min)" type="number" min="5" max="480" required /><TextField name="price" label="Preço" type="number" step=".01" min="0" required /></div>
      <button className="btn primary">Salvar serviço</button>
    </DrawerForm>}
    <EditableOperationalTable title="Serviços" resource="services" rows={data["/services"] ?? []} fields={["name", "duration_minutes", "price_cents", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "duration_minutes", label: "Duração (min)", type: "number", min: 5, max: 480, required: true }, { name: "price", label: "Preço", type: "number", min: 0, step: ".01", required: true, value: (row) => Number(row.price_cents ?? 0) / 100 }]}
      buildBody={(form) => ({ name: value(form, "name"), duration_minutes: Number(value(form, "duration_minutes")), price_cents: cents(value(form, "price")) })} onChanged={reload} onNotice={setNotice} allowDelete={canDelete} canEdit={canEdit} />
  </div>;
}

function FormularioProfissional({ data, reload, setNotice, submit, canDelete = false, canEdit = true }: AdministrationSectionProps) {
  const units: Unit[] = data["/units"] ?? [];
  const professionals = (data["/professionals"] ?? []).map((professional: Row) => ({
    ...professional,
    unit_names: (professional.unit_ids ?? []).map((unitId: string) => units.find((unit) => unit.id === unitId)?.name).filter(Boolean).join(", ") || "Sem unidade",
  }));
  return <div className="administration-section">
    {canEdit && <DrawerForm title="Novo profissional" className="administration-form" onSubmit={(event) => submit(event, "/professionals", (form) => ({ name: value(form, "name"), council: value(form, "council") || undefined, specialty: value(form, "specialty") || undefined, unitIds: form.getAll("unitIds"), active: true }))}>
      <h2>Novo profissional</h2><p className="form-instructions">Informe os dados profissionais e selecione ao menos uma unidade.</p>
      <TextField name="name" label="Nome" required />
      <div className="form-row"><TextField name="council" label="Conselho" /><TextField name="specialty" label="Especialidade" /></div>
      <FormSection legend="Unidades"><div className="weekday-checks">{units.map((unit) => <CheckboxField key={unit.id} name="unitIds" value={unit.id} label={unit.name} />)}</div></FormSection>
      <button className="btn primary">Salvar profissional</button>
    </DrawerForm>}
    <EditableOperationalTable title="Profissionais" resource="professionals" rows={professionals} fields={["name", "council", "specialty", "unit_names", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "council", label: "Conselho" }, { name: "specialty", label: "Especialidade" }, { name: "unitIds", label: "Unidades em que atende", type: "checkbox-group", required: true, options: units, value: (row) => row.unit_ids ?? [] }]}
      buildBody={(form) => ({ name: value(form, "name"), council: value(form, "council") || null, specialty: value(form, "specialty") || null, unitIds: form.getAll("unitIds").map(String) })} onChanged={reload} onNotice={setNotice} allowDelete={canDelete} canEdit={canEdit} />
  </div>;
}

function FormularioModeloClinico({ data, reload, setNotice, submit, canDelete = false, canEdit = true }: AdministrationSectionProps) {
  return <div className="administration-section">
    {canEdit && <DrawerForm title="Novo modelo clínico" className="administration-form" onSubmit={(event) => submit(event, "/record-templates", (form) => ({ name: value(form, "name"), kind: value(form, "kind"), specialty: value(form, "specialty") || undefined, schema: {}, active: true }))}>
      <h2>Novo modelo clínico</h2><p className="form-instructions">Crie uma base para avaliações ou evoluções clínicas.</p>
      <TextField name="name" label="Nome" required minLength={3} />
      <div className="form-row"><SelectField name="kind" label="Tipo" required><option value="assessment">Avaliação</option><option value="evolution">Evolução</option></SelectField><TextField name="specialty" label="Especialidade" /></div>
      <button className="btn primary">Salvar modelo</button>
    </DrawerForm>}
    <EditableOperationalTable title="Modelos clínicos" resource="record-templates" rows={data["/record-templates"] ?? []} fields={["name", "kind", "specialty", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "specialty", label: "Especialidade" }]}
      buildBody={(form) => ({ name: value(form, "name"), specialty: value(form, "specialty") || null })} onChanged={reload} onNotice={setNotice} allowDelete={canDelete} canEdit={canEdit} />
  </div>;
}

const administrationTabs: Array<{ id: AdministrationTab; label: string }> = [
  { id: "units", label: "Unidades" }, { id: "rooms", label: "Salas" },
  { id: "services", label: "Serviços" }, { id: "professionals", label: "Profissionais" },
  { id: "templates", label: "Modelos clínicos" },
];

export function OperationalAdministration({ canEdit = true, canManageUnits = false, canDelete = false }: { canEdit?: boolean; canManageUnits?: boolean; canDelete?: boolean }) {
  const paths = [
    "/units",
    "/rooms",
    "/professionals",
    "/services",
    "/record-templates",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<AdministrationTab>("units");
  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: (form: FormData) => Row,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body(form)) });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Cadastro salvo.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">ESTRUTURA DA CLÍNICA</p>
          <h1>Configurações operacionais</h1>
          <p>Unidades, salas, equipe, serviços e modelos clínicos.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <nav className="administration-tabs" role="tablist" aria-label="Tipos de configuração">
        {administrationTabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
          id={`administration-tab-${tab.id}`} aria-selected={activeTab === tab.id}
          aria-controls={`administration-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1}
          className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? administrationTabs.length - 1
              : (index + (event.key === "ArrowRight" ? 1 : -1) + administrationTabs.length) % administrationTabs.length;
            setActiveTab(administrationTabs[nextIndex].id);
            const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons?.[nextIndex]?.focus();
          }}>{tab.label}</button>)}
      </nav>
      <ModuleState loading={loading} error={error} retry={reload} />
      {!loading && !error && <section key={activeTab} className="administration-tab-panel" role="tabpanel"
        id={`administration-panel-${activeTab}`} aria-labelledby={`administration-tab-${activeTab}`} tabIndex={0}>
        {activeTab === "units" && <FormularioUnidade data={data} reload={reload} setNotice={setNotice} submit={submit} canEdit={canEdit} canManageUnits={canManageUnits} canDelete={canDelete} />}
        {activeTab === "rooms" && <FormularioSala data={data} reload={reload} setNotice={setNotice} submit={submit} canEdit={canEdit} canDelete={canDelete} />}
        {activeTab === "services" && <FormularioServico data={data} reload={reload} setNotice={setNotice} submit={submit} canEdit={canEdit} canDelete={canDelete} />}
        {activeTab === "professionals" && <FormularioProfissional data={data} reload={reload} setNotice={setNotice} submit={submit} canEdit={canEdit} canDelete={canDelete} />}
        {activeTab === "templates" && <FormularioModeloClinico data={data} reload={reload} setNotice={setNotice} submit={submit} canEdit={canEdit} canDelete={canDelete} />}
      </section>}
    </div>
  );
}
