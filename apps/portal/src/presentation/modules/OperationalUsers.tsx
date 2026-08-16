import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { CheckboxField, FormSection, SelectField, TextField } from "../components/FormPrimitives";
import { Row, Unit, messageOf, value, useResources, DrawerForm, ModuleState } from "./OperationalShared";

export function OperationalUsers({ canManageUsers }: { canManageUsers: boolean }) {
  const { data, loading, error, reload } = useResources(["/users", "/units"]);
  const [notice, setNotice] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const permissionModules = [
    ["dashboard", "Painel"], ["agenda", "Agenda"], ["patients", "Pacientes"], ["enrollments", "Matrículas"], ["records", "Prontuários"],
    ["finance", "Financeiro"], ["reports", "Relatórios"], ["imports", "Importações"], ["users", "Usuários"], ["settings", "Configurações"], ["privacy", "Privacidade"],
  ] as const;
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/users/invite", {
        method: "POST",
        body: JSON.stringify({
          email: value(f, "email"),
          name: value(f, "name"),
          role: value(f, "role"),
          unitIds: f.getAll("unitIds"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Convite enviado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function update(id: string, status: string) {
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
      setNotice(status === "active" ? "Conta ativada. A colaboradora já pode concluir o primeiro acesso." : "Conta bloqueada.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function saveUser(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: value(form, "name"),
          role: value(form, "role"),
          status: value(form, "status"),
          unitIds: form.getAll("unitIds"),
          permissions: Object.fromEntries(permissionModules.map(([module]) => [module, { canView: form.get(`permission-${module}`) === "on", canEdit: form.get(`permission-edit-${module}`) === "on" }])),
        }),
      });
      await reload();
      setEditingUserId("");
      setNotice("Usuária atualizada.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function resendAccess(id: string) {
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}/resend-access`, { method: "POST" });
      setNotice("Novo link de acesso enviado por e-mail.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function removeUser(row: Row) {
    if (!window.confirm(`Excluir o acesso de ${row.name}? O histórico será preservado, mas a conta não poderá mais entrar.`)) return;
    setUpdatingUserId(row.id);
    setNotice("");
    try {
      await api(`/users/${row.id}`, { method: "DELETE" });
      await reload();
      setNotice("Acesso excluído e histórico preservado.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">ACESSOS E PERMISSÕES</p>
          <h1>Usuários</h1>
          <p>Convites, perfis, unidades, permissões e bloqueio de acesso.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {!canManageUsers && (
        <div className="environment-warning" role="status">
          Você pode consultar os acessos, mas somente uma administradora pode convidar, ativar ou bloquear contas.
        </div>
      )}
      {canManageUsers && <DrawerForm title="Convidar colaboradora" onSubmit={invite}>
        <h2>Convidar colaboradora</h2>
        <div className="form-row">
          <TextField name="name" label="Nome" required />
          <TextField name="email" label="E-mail" type="email" required />
        </div>
        <SelectField name="role" label="Perfil">
            <option value="reception">Recepção</option>
            <option value="professional">Profissional</option>
            <option value="finance">Financeiro</option>
            <option value="manager">Gestor</option>
            <option value="admin">Administrador</option>
        </SelectField>
        <FormSection legend="Unidades"><div className="weekday-checks">
            {(data["/units"] ?? []).map((u: Unit) => (
              <CheckboxField key={u.id} name="unitIds" value={u.id} label={u.name} />
            ))}
          </div></FormSection>
        <button className="btn primary">Enviar convite</button>
      </DrawerForm>}
      <section className="card table-card bespoke-table users-list-table">
        <div className="table-toolbar"><h2>Colaboradoras cadastradas</h2><span>{(data["/users"] ?? []).length} registros</span></div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Nome</span><span>Acesso e segurança</span><span>Ações</span></div>
        {(data["/users"] ?? []).map((row: Row) => (
          <div className="user-management-entry" key={row.id}>
          <div className="operational-row">
            <div>
              <strong>
                {row.name}
                {row.is_owner ? " · Proprietário" : ""}
              </strong>
              <small>
                {row.email ? `${row.email} · ` : ""}{row.role} · {row.status}
              </small>
            </div>
            {row.is_owner ? (
              <span className="status info">Conta protegida</span>
            ) : !canManageUsers ? (
              <span className="status info">Somente leitura</span>
            ) : (
              <div className="row-actions">
                <button type="button" disabled={updatingUserId === row.id} onClick={() => setEditingUserId(editingUserId === row.id ? "" : row.id)}>
                  {editingUserId === row.id ? "Cancelar edição" : "Editar"}
                </button>
                {row.status !== "active" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => update(row.id, "active")}>
                    {updatingUserId === row.id ? "Ativando…" : "Ativar"}
                  </button>
                )}
                {row.status !== "blocked" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => update(row.id, "blocked")}>
                    {updatingUserId === row.id ? "Aguarde…" : "Bloquear"}
                  </button>
                )}
                {row.status !== "blocked" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => resendAccess(row.id)}>
                    Reenviar acesso
                  </button>
                )}
                <button className="action-delete" type="button" disabled={updatingUserId === row.id} onClick={() => removeUser(row)}>
                  Excluir
                </button>
              </div>
            )}
          </div>
          {canManageUsers && editingUserId === row.id && !row.is_owner && (
            <form className="user-edit-form" onSubmit={(event) => saveUser(event, row.id)}>
              <div className="form-row">
                <TextField name="name" label="Nome" defaultValue={row.name} required minLength={3} />
                <SelectField name="role" label="Perfil" defaultValue={row.role}>
                  <option value="reception">Recepção</option><option value="professional">Profissional</option>
                  <option value="finance">Financeiro</option><option value="manager">Gestor</option><option value="admin">Administrador</option>
                </SelectField>
                <SelectField name="status" label="Situação" defaultValue={row.status}>
                  <option value="invited">Convidada</option><option value="active">Ativa</option><option value="blocked">Bloqueada</option>
                </SelectField>
              </div>
              <fieldset><legend>Unidades</legend><div className="weekday-checks">
                {(data["/units"] ?? []).map((unit: Unit) => <CheckboxField key={unit.id} name="unitIds" value={unit.id} label={unit.name} defaultChecked={(row.profile_units ?? []).some((item: Row) => item.unit_id === unit.id)} />)}
              </div></fieldset>
              <fieldset><legend>Acesso por módulo</legend><div className="permission-grid"><strong>Módulo</strong><strong>Visualizar</strong><strong>Editar</strong>
                {permissionModules.map(([module, label]) => { const permission = (row.profile_permissions ?? []).find((item: Row) => item.module === module); return <><span key={`${row.id}-${module}-label`}>{label}</span><CheckboxField key={`${row.id}-${module}-view`} name={`permission-${module}`} label="Pode visualizar" defaultChecked={permission?.can_view} /><CheckboxField key={`${row.id}-${module}-edit`} name={`permission-edit-${module}`} label="Pode editar" defaultChecked={permission?.can_edit} /></>; })}
              </div><small>Editar inclui visualizar. O administrador mantém o acesso total.</small></fieldset>
              <button className="btn primary" type="submit" disabled={updatingUserId === row.id}>{updatingUserId === row.id ? "Salvando…" : "Salvar alterações"}</button>
            </form>
          )}
          </div>
        ))}
      </section>
    </div>
  );
}
