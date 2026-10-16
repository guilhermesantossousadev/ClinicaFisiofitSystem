import { confirmAction } from '../components/Decisions';
import { Notice, Tabs, FilterSummary } from "@fisiofit/design-system/react";
import { DetailPanel, Facts, RelatedActions, useModuleState, useWorkspace } from "../components/ModuleWorkspace";
import { financialOverview } from "./financialOverview";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { CheckboxField, SelectField, TextField } from "../components/FormPrimitives";
import { Row, messageOf, statusLabel, value, cents, brl, useResources, Select, DrawerForm, ModuleState, MetricLite, OperationalTable } from "./OperationalShared";

export function OperationalFinance({ canEdit = true }: { canEdit?: boolean }) {
  const today = new Date();
  const workspace = useWorkspace();
  const contextPatient = workspace?.journey?.patient;
  const [month, setMonth] = useModuleState("finance.month", () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [section, setSection] = useModuleState("finance.section", "charges");
  const [search, setSearch] = useModuleState("finance.search", "");
  const [status, setStatus] = useModuleState("finance.status", "all");
  const [selectedCharge, setSelectedCharge] = useState<Row | null>(null);
  useEffect(() => { const requestedMonth = workspace?.journey?.section; if (requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)) setMonth(requestedMonth); }, [workspace?.journey?.section]);
  const first = `${month}-01`;
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12)
    .toISOString()
    .slice(0, 10);
  const paths = [
    `/financial-entries?from=${first}&to=${last}`,
    "/charges",
    "/payments",
    "/commissions",
    "/professionals",
    "/units",
    ...(workspace?.allowed.includes('Matrículas') ? ['/enrollments'] : []),
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
    if (!await confirmAction("Excluir este lançamento? Ele ficará oculto, mas será mantido no histórico.", { confirmLabel: "Excluir lançamento", destructive: true })) return;
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
  const namedCharges = (data['/charges'] ?? []).map((charge: Row) => { const enrollment = (data['/enrollments'] ?? []).find((enrollment: Row) => enrollment.id === charge.enrollment_id); return {...charge, patients:charge.patients || charge.patient || enrollment?.patient || (contextPatient?.id === charge.patient_id ? contextPatient : undefined)}; });
  const overview = financialOverview(namedCharges, data['/payments'] ?? [], month, contextPatient?.id);
  const visibleCharges = overview.charges.filter((row: Row) => (status === 'all' || row.status === status) && (!search.trim() || `${row.patients?.name ?? row.patient?.name ?? ''} ${row.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))));
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">VISÃO FINANCEIRA</p>
          <h1>Financeiro</h1>
          <p>Cobranças, recebimentos e movimentos com suas próprias datas de referência.</p>
        </div>
      </div>
      {notice && (
        <Notice message={notice} onDismiss={() => setNotice("")} />
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {contextPatient && <section className="patient-workspace-heading"><div><p className="eyebrow">COBRANÇAS E RECEBIMENTOS DO PACIENTE</p><h2>{contextPatient.name}</h2></div><RelatedActions patient={contextPatient} exclude="Financeiro" /></section>}
      <div className="collection-toolbar card"><TextField label="Mês de referência" type="month" value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} /><p>Cobranças por vencimento · recebimentos por data do pagamento · movimentos por competência.</p></div>
      {!loading && !error && <div className="metrics financial-overview"><MetricLite label="Cobrado · vencimento no mês" value={brl(overview.billed)} /><MetricLite label="Recebido nessas cobranças" value={brl(overview.paidOnCharges)} /><MetricLite label="Saldo dessas cobranças" value={brl(overview.outstanding)} /><MetricLite label="Recebimentos feitos no mês" value={brl(overview.received)} /></div>}
      <Tabs id="finance-workspace" label="Áreas financeiras" value={section} onChange={setSection} items={[{value:'charges',label:'Cobranças'},{value:'receipts',label:'Recebimentos'},{value:'entries',label:'Movimentos e comissões'}]} />
      <section role="tabpanel" id={`finance-workspace-panel-${section}`} aria-labelledby={`finance-workspace-${section}`} tabIndex={0}>
      {!loading && !error && section === 'charges' && <><div className="collection-toolbar"><TextField label="Buscar cobrança ou paciente" type="search" value={search} onChange={event => setSearch(event.target.value)} /><SelectField label="Situação da cobrança" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todas as situações</option>{['pending','partial','paid','overdue'].map(key => <option key={key} value={key}>{statusLabel(key)}</option>)}</SelectField>{(search || status !== 'all') && <button className="btn secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Limpar filtros</button>}</div><FilterSummary count={visibleCharges.length} filters={[`Vencimento: ${month}`, ...(contextPatient ? [contextPatient.name] : []), ...(status !== 'all' ? [statusLabel(status)] : [])]} /><OperationalTable title="Cobranças do período" rows={visibleCharges.map((row: Row) => ({...row, patient_name:row.patients?.name || row.patient?.name || 'Paciente não informado', balance_cents:Math.max(0,Number(row.amount_cents)-Number(row.paid_cents))}))} fields={['patient_name','description','due_at','status','amount_cents','paid_cents','balance_cents']} emptyMessage="Nenhuma cobrança corresponde ao período e aos filtros." actions={row => <button type="button" onClick={() => setSelectedCharge(row)}>Detalhes da cobrança</button>} /></>}
      {!loading && !error && section === 'receipts' && <><p className="section-caption">Pagamentos com data em {month}. Podem quitar cobranças de outros períodos.</p><OperationalTable title="Recebimentos no mês" rows={overview.receipts} fields={['paid_at','amount_cents','method']} emptyMessage="Nenhum recebimento registrado neste mês." actions={row => { const charge = namedCharges.find((charge: Row) => charge.id === row.charge_id); return charge ? <button onClick={() => setSelectedCharge(charge)}>Ver cobrança de origem</button> : null; }} /></>}
      {section === 'entries' && <>
      <p className="section-caption">Movimentos e comissões da unidade. Os totais abaixo são de competência e não representam o saldo de cobranças.</p>
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
          <button className="btn primary">Registrar movimento</button>
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
        actions={(row) => canEdit ? <button type="button" className="action-delete" onClick={() => void removeEntry(row.id)}>Excluir</button> : null}
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
      </>}
      </section>
      {selectedCharge && <DetailPanel title={selectedCharge.description || "Detalhes da cobrança"} eyebrow="COBRANÇA E RECEBIMENTOS" onClose={() => setSelectedCharge(null)}><Facts items={[["Paciente", selectedCharge.patients?.name || selectedCharge.patient?.name], ["Situação", statusLabel(selectedCharge.status)], ["Vencimento", selectedCharge.due_at ? new Date(`${selectedCharge.due_at}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'], ["Cobrado", brl(Number(selectedCharge.amount_cents))], ["Recebido", brl(Number(selectedCharge.paid_cents))], ["Saldo pendente", brl(Math.max(0,Number(selectedCharge.amount_cents)-Number(selectedCharge.paid_cents)))], ["Cobertura", selectedCharge.coverage_from && selectedCharge.coverage_to ? `${new Date(`${selectedCharge.coverage_from}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${selectedCharge.coverage_to}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Não informada']]} /><h3>Histórico de recebimentos</h3>{(data['/payments'] ?? []).filter((payment: Row) => payment.charge_id === selectedCharge.id && !payment.deleted_at && !payment.reversed_at).map((payment: Row) => <Facts key={payment.id} items={[["Valor", brl(Number(payment.amount_cents))], ["Data", new Date(payment.paid_at).toLocaleDateString('pt-BR')], ["Forma", statusLabel(payment.method)]]} />)}{!(data['/payments'] ?? []).some((payment: Row) => payment.charge_id === selectedCharge.id && !payment.deleted_at && !payment.reversed_at) && <p>Nenhum recebimento disponível para esta cobrança.</p>}{selectedCharge.patient_id && <RelatedActions patient={{id:selectedCharge.patient_id,name:selectedCharge.patients?.name || selectedCharge.patient?.name || 'Paciente'}} exclude="Financeiro" />}<button type="button" className="btn secondary" onClick={() => setSelectedCharge(null)}>Voltar às cobranças com os filtros</button></DetailPanel>}
    </div>
  );
}
