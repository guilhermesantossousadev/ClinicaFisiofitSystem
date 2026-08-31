import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { CheckboxField, SelectField, TextField } from "../components/FormPrimitives";
import { Row, messageOf, statusLabel, value, cents, brl, useResources, Select, DrawerForm, ModuleState, MetricLite, OperationalTable } from "./OperationalShared";

export function OperationalFinance({ canEdit = true }: { canEdit?: boolean }) {
  const today = new Date();
  const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const paths = [
    `/financial-entries?from=${first}&to=${last}`,
    "/charges",
    "/payments",
    "/commissions",
    "/professionals",
    "/units",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  async function entry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/financial-entries", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(f, "unit_id"),
          kind: value(f, "kind"),
          description: value(f, "description"),
          category: value(f, "category"),
          cost_center: value(f, "cost_center") || undefined,
          amount_cents: cents(value(f, "amount")),
          competence_date: value(f, "date"),
          settled_at: f.get("settled") ? new Date().toISOString() : undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Movimento salvo.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function commission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/commissions", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(f, "unit_id"),
          professional_id: value(f, "professional_id"),
          amount_cents: cents(value(f, "amount")),
          basis: value(f, "basis"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Comissão calculada.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function removeEntry(id: string) {
    if (!window.confirm("Excluir este lançamento? Ele ficará oculto, mas será mantido no histórico.")) return;
    try {
      await api(`/financial-entries/${id}`, { method: "DELETE" });
      await reload();
      setNotice("Lançamento excluído.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function approve(id: string) {
    try {
      await api(`/commissions/${id}/approve`, { method: "POST" });
      await reload();
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  const entries: Row[] = data[paths[0]] ?? [];
  const income = entries
    .filter((x) => x.kind === "income")
    .reduce((s, x) => s + x.amount_cents, 0);
  const expense = entries
    .filter((x) => x.kind === "expense")
    .reduce((s, x) => s + x.amount_cents, 0);
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">FINANCEIRO REAL</p>
          <h1>Entradas, saídas e comissões</h1>
          <p>Regime de competência e realizado por unidade.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <div className="metrics">
        <MetricLite label="Receitas do mês" value={brl(income)} />
        <MetricLite label="Despesas do mês" value={brl(expense)} />
        <MetricLite label="Resultado" value={brl(income - expense)} />
        <MetricLite
          label="Comissões"
          value={(data["/commissions"] ?? []).length}
        />
      </div>
      {canEdit && <div className="dashboard-grid">
        <DrawerForm title="Novo movimento" onSubmit={entry}>
          <h2>Novo movimento</h2>
          <div className="form-row">
            <Select
              name="unit_id"
              label="Unidade"
              rows={data["/units"] ?? []}
            />
            <SelectField name="kind" label="Tipo">
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
            </SelectField>
          </div>
          <TextField name="description" label="Descrição" required />
          <div className="form-row">
            <TextField name="category" label="Categoria" required />
            <TextField name="cost_center" label="Centro de custo" />
          </div>
          <div className="form-row">
            <TextField name="amount" label="Valor" type="number" step=".01" required />
            <TextField
              label="Competência"
                name="date"
                type="date"
                required
                defaultValue={today.toISOString().slice(0, 10)}
              />
          </div>
          <CheckboxField name="settled" label="Já realizado" />
          <button className="btn primary">Lançar</button>
        </DrawerForm>
        <DrawerForm title="Nova comissão" onSubmit={commission}>
          <h2>Nova comissão</h2>
          <Select name="unit_id" label="Unidade" rows={data["/units"] ?? []} />
          <Select
            name="professional_id"
            label="Profissional"
            rows={data["/professionals"] ?? []}
          />
          <div className="form-row">
            <SelectField name="basis" label="Base">
                <option value="appointment">Atendimento</option>
                <option value="payment">Recebimento</option>
            </SelectField>
            <TextField name="amount" label="Valor" type="number" step=".01" required />
          </div>
          <button className="btn primary">Calcular comissão</button>
        </DrawerForm>
      </div>}
      <OperationalTable
        title="Movimentos do mês"
        rows={entries}
        fields={[
          "competence_date",
          "description",
          "category",
          "kind",
          "amount_cents",
        ]}
        emptyMessage="Nenhum movimento financeiro foi lançado neste mês."
        actions={(row) => canEdit ? <button type="button" onClick={() => void removeEntry(row.id)}>Excluir</button> : null}
      />
      <section className="card table-card bespoke-table commissions-list-table">
        <div className="table-toolbar">
          <h2>Comissões</h2>
        </div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Valor</span><span>Base e status</span><span>Ações</span></div>
        {(data["/commissions"] ?? []).map((row: Row) => (
          <div className="operational-row" key={row.id}>
            <div>
              <strong>{brl(row.amount_cents)}</strong>
              <small>
                {statusLabel(row.basis)} · {statusLabel(row.status)}
              </small>
            </div>
            {canEdit && row.status === "pending" && (
              <button onClick={() => approve(row.id)}>
                Aprovar e lançar despesa
              </button>
            )}
          </div>
        ))}
        {!(data["/commissions"] ?? []).length && <div className="empty-state">Nenhuma comissão foi calculada para o período.</div>}
      </section>
    </div>
  );
}
