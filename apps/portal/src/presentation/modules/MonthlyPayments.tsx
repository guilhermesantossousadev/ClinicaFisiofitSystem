import { useMemo, useState } from "react";
import { buildMonthlyPaymentRows, type MonthlyPaymentRow } from "../../application/portal/monthlyPaymentControl";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type Row, brl, dateKey, messageOf } from "./OperationalShared";

type PaymentFilter = "all" | "paid" | "open" | "unbilled";

function coverageEnd(month: string, durationDays: number) {
  const start = new Date(`${month}-01T12:00:00`);
  start.setDate(start.getDate() + Math.max(durationDays, 1) - 1);
  return dateKey(start);
}

function stateLabel(state: MonthlyPaymentRow["state"]) {
  return ({ paid: "Pago", partial: "Pagamento parcial", overdue: "Atrasado", pending: "Aguardando pagamento", unbilled: "Sem cobrança", cancelled: "Cancelada" } as const)[state];
}

export function MonthlyPayments({ data, month, onMonth, canEdit, reload, onNotice }: { data: Record<string, Row[]>; month: string; onMonth: (month: string) => void; canEdit: boolean; reload: () => Promise<void>; onNotice: (text: string) => void }) {
  const [savingEnrollmentId, setSavingEnrollmentId] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const enrollments: Row[] = data["/enrollments"] ?? [];
  const plans: Row[] = data["/plans"] ?? [];
  const patients: Row[] = (data["/patients?page=1&pageSize=100"] as unknown as { items?: Row[] })?.items ?? [];
  const charges: Row[] = data["/charges"] ?? [];
  const rows = useMemo(() => buildMonthlyPaymentRows({ month, enrollments, patients, plans, charges }), [month, enrollments, patients, plans, charges]);
  const filteredRows = rows.filter((row) => {
    const matchesSearch = !search.trim() || `${row.patientName} ${row.planName}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
    const matchesFilter = filter === "all" || (filter === "paid" && row.state === "paid") || (filter === "open" && ["pending", "partial", "overdue"].includes(row.state)) || (filter === "unbilled" && row.state === "unbilled");
    return matchesSearch && matchesFilter;
  });
  const paidCount = rows.filter((row) => row.state === "paid").length;
  const pendingCount = rows.filter((row) => ["pending", "partial", "overdue"].includes(row.state)).length;
  const unbilledCount = rows.filter((row) => row.state === "unbilled").length;

  async function createCharge(row: MonthlyPaymentRow) {
    if (savingEnrollmentId) return;
    const enrollment = enrollments.find((item) => item.id === row.enrollmentId);
    const plan = plans.find((item) => item.id === enrollment?.plan_id);
    setSavingEnrollmentId(row.enrollmentId);
    try {
      await api("/charges", { method: "POST", body: JSON.stringify({ patient_id: row.patientId, enrollment_id: row.enrollmentId, unit_id: row.unitId, description: `${row.planName} · ${month}`, amount_cents: row.amountCents, due_at: row.dueAt, coverage_from: `${month}-01`, coverage_to: coverageEnd(month, Number(plan?.duration_days ?? 30)) }) });
      await reload();
      onNotice("Cobrança do período criada. Agora registre o recebimento abaixo.");
    } catch (error) { onNotice(messageOf(error)); } finally { setSavingEnrollmentId(""); }
  }

  return <section className="card table-card" aria-labelledby="monthly-payments-title">
    <div className="table-toolbar"><div><p className="eyebrow">CONTROLE DE PLANOS</p><h2 id="monthly-payments-title">Controle de planos dos pacientes</h2><p>Confira o pagamento do período selecionado. “Pago” só aparece depois do recebimento registrado.</p></div>
      <div className="plan-control-filters"><TextField label="Mês de referência" type="month" value={month} onChange={(event) => event.target.value && onMonth(event.target.value)} /><TextField label="Buscar" type="search" placeholder="Paciente ou plano" value={search} onChange={(event) => setSearch(event.target.value)} /><SelectField label="Pagamento" value={filter} onChange={(event) => setFilter(event.target.value as PaymentFilter)}><option value="all">Todos</option><option value="paid">Pagos</option><option value="open">Não pagos / em aberto</option><option value="unbilled">Sem cobrança lançada</option></SelectField></div>
    </div>
    <div className="plan-control-result" role="status" aria-live="polite"><strong>{paidCount} pagos</strong> · {pendingCount} em aberto · {unbilledCount} sem cobrança · exibindo {filteredRows.length} de {rows.length} matrículas</div>
    <div style={{ overflowX: "auto" }}><table><thead><tr><th scope="col">Paciente</th><th scope="col">Plano / período</th><th scope="col">Vencimento</th><th scope="col">Situação</th><th scope="col">Valor</th><th scope="col">Ação</th></tr></thead><tbody>
      {filteredRows.map((row) => <tr key={row.enrollmentId}><td>{row.patientName}</td><td>{row.planName}<br /><small>{row.coverageFrom} a {row.coverageTo || "a definir"}</small></td><td>{new Date(`${row.dueAt}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td><span className={`plan-status payment-status-${row.state}`}>{stateLabel(row.state)}</span></td><td>{row.state === "cancelled" ? "—" : `${brl(row.paidCents)} de ${brl(row.amountCents)}`}</td><td>{row.state === "unbilled" && canEdit ? <button type="button" className="btn secondary" disabled={Boolean(savingEnrollmentId)} onClick={() => void createCharge(row)}>{savingEnrollmentId === row.enrollmentId ? "Criando…" : "Lançar cobrança"}</button> : row.state === "paid" ? "Recebido" : row.state === "cancelled" ? "—" : "Use Registrar pagamento"}</td></tr>)}
    </tbody></table></div>
    {!filteredRows.length && <div className="empty-state">Nenhuma matrícula corresponde ao mês, à busca ou ao filtro.</div>}
  </section>;
}
