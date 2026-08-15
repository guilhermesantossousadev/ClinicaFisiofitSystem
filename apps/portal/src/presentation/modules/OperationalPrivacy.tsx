import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { messageOf, value, useResources, DrawerForm, ModuleState, OperationalTable } from "./OperationalShared";

export function OperationalPrivacy() {
  const paths = ["/privacy/requests", "/privacy/incidents", "/audit"];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/privacy/requests", {
        method: "POST",
        body: JSON.stringify({
          requester_name: value(form, "name"),
          requester_email: value(form, "email") || undefined,
          requester_phone: value(form, "phone") || undefined,
          kind: value(form, "kind"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Solicitação registrada.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function incident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/privacy/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: value(form, "title"),
          description: value(form, "description"),
          severity: value(form, "severity"),
          discovered_at: new Date(value(form, "discovered_at")).toISOString(),
          data_categories: value(form, "categories")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          mitigation: value(form, "mitigation") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Incidente registrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">LGPD E PRESTAÇÃO DE CONTAS</p>
          <h1>Privacidade e auditoria</h1>
          <p>Solicitações dos titulares, incidentes e histórico de ações.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <div className="dashboard-grid">
        <DrawerForm title="Nova solicitação" onSubmit={request}>
          <h2>Nova solicitação</h2>
          <TextField name="name" label="Solicitante" required />
          <div className="form-row">
            <TextField name="email" label="E-mail" type="email" />
            <TextField name="phone" label="Telefone" />
          </div>
          <SelectField name="kind" label="Direito solicitado">
              <option value="access">Acesso</option>
              <option value="correction">Correção</option>
              <option value="sharing">Compartilhamentos</option>
              <option value="opposition">Oposição</option>
              <option value="portability">Portabilidade</option>
              <option value="revocation">Revogação</option>
              <option value="deletion">Eliminação aplicável</option>
          </SelectField>
          <button className="btn primary">Registrar solicitação</button>
        </DrawerForm>
        <DrawerForm title="Novo incidente" onSubmit={incident}>
          <h2>Novo incidente</h2>
          <TextField name="title" label="Título" required />
          <TextareaField name="description" label="Descrição" rows={3} required minLength={10} />
          <div className="form-row">
            <SelectField name="severity" label="Severidade">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
            </SelectField>
            <TextField name="discovered_at" label="Descoberto em" type="datetime-local" required />
          </div>
          <TextField
            label="Categorias afetadas"
              name="categories"
              placeholder="saúde, financeiro, autenticação"
            />
          <TextareaField name="mitigation" label="Mitigação" rows={2} />
          <button className="btn primary">Registrar incidente</button>
        </DrawerForm>
      </div>
      <OperationalTable
        title="Solicitações de titulares"
        rows={data["/privacy/requests"] ?? []}
        fields={["requester_name", "kind", "status", "due_at"]}
      />
      <OperationalTable
        title="Incidentes"
        rows={data["/privacy/incidents"] ?? []}
        fields={["title", "severity", "status", "discovered_at"]}
      />
      <OperationalTable
        title="Auditoria recente"
        rows={data["/audit"] ?? []}
        fields={["action", "entity_type", "user_id", "occurred_at"]}
      />
    </div>
  );
}

