import { Notice, Tabs } from "@fisiofit/design-system/react";
import { DetailPanel, Facts, SectionIntro, useModuleState } from "../components/ModuleWorkspace";
import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { messageOf, value, useResources, DrawerForm, ModuleState, OperationalTable, type Row, fieldLabel, render } from "./OperationalShared";

export function privacyResourcePaths(canManageIncidents: boolean) {
  return canManageIncidents
    ? ["/privacy/requests", "/privacy/incidents", "/audit"]
    : ["/privacy/requests", "/audit"];
}

export function OperationalPrivacy({
  canEditPrivacy,
  canManageIncidents,
}: {
  canEditPrivacy: boolean;
  canManageIncidents: boolean;
}) {
  // Incidentes possuem dados especialmente sensíveis e são restritos ao admin
  // tanto na API quanto no RLS. Não devemos sequer requisitá-los para gestores.
  const paths = privacyResourcePaths(canManageIncidents);
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useModuleState('privacy.section', 'requests');
  const [query, setQuery] = useModuleState('privacy.query', '');
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const matches = (row: Row) => !query.trim() || [row.requester_name,row.title,row.action,row.entity_type,row.kind,row.status].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
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
        <Notice message={notice} onDismiss={() => setNotice("")} />
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <Tabs id="privacy-workspace" label="Áreas de privacidade" value={section} onChange={setSection} items={[{value:'requests',label:'Solicitações'},...(canManageIncidents ? [{value:'incidents',label:'Incidentes'}] : []),{value:'audit',label:'Auditoria'}]} />
      <SectionIntro title="Acompanhamento e prestação de contas">Consulte solicitações e eventos autorizados. Incidentes são restritos à administração.</SectionIntro>
      <TextField label="Buscar nos registros de privacidade" type="search" value={query} onChange={event => setQuery(event.target.value)} />
      {canEditPrivacy && <div className="dashboard-grid">
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
        {canManageIncidents && <DrawerForm title="Novo incidente" onSubmit={incident}>
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
        </DrawerForm>}
      </div>}
      <section role="tabpanel" id={`privacy-workspace-panel-${section}`} aria-labelledby={`privacy-workspace-${section}`} tabIndex={0}>
      {section === 'requests' && <OperationalTable
        title="Solicitações de titulares"
        rows={(data["/privacy/requests"] ?? []).filter(matches)}
        fields={["requester_name", "kind", "status", "due_at"]}
        emptyMessage="Nenhuma solicitação de titular foi registrada."
        actions={row => <button onClick={() => setSelectedRow(row)}>Detalhes da solicitação</button>}
      />}
      {canManageIncidents && section === 'incidents' && (
        <OperationalTable
          title="Incidentes"
          rows={(data["/privacy/incidents"] ?? []).filter(matches)}
          fields={["title", "severity", "status", "discovered_at"]}
          emptyMessage="Nenhum incidente de privacidade foi registrado."
          actions={row => <button onClick={() => setSelectedRow(row)}>Detalhes do incidente</button>}
        />
      )}
      {section === 'audit' && <OperationalTable
        title="Auditoria recente"
        rows={(data["/audit"] ?? []).filter(matches)}
        fields={["action", "entity_type", "user_id", "occurred_at"]}
        emptyMessage="Nenhum evento de auditoria está disponível para consulta."
        actions={row => <button onClick={() => setSelectedRow(row)}>Detalhes do evento</button>}
      />}
      </section>
      {selectedRow && <DetailPanel title={selectedRow.title || selectedRow.requester_name || 'Evento de auditoria'} eyebrow="REGISTRO DE PRIVACIDADE" onClose={() => setSelectedRow(null)}><Facts items={['kind','status','severity','due_at','discovered_at','occurred_at','action','entity_type','description','mitigation'].filter(key => selectedRow[key] != null).map(key => [fieldLabel(key),render(selectedRow[key],key)])} /></DetailPanel>}
    </div>
  );
}
