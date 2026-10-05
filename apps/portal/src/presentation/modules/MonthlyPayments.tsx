import { type FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type Row, brl, cents, dateKey, messageOf, value } from "./OperationalShared";

export function MonthlyPayments({ data, month, onMonth, canEdit, reload, onNotice }: { data: Record<string, Row[]>; month: string; onMonth: (month: string) => void; canEdit: boolean; reload: () => Promise<void>; onNotice: (text: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState("");
  const enrollments: Row[] = data["/enrollments"] ?? [];
  const plans: Row[] = data["/plans"] ?? [];
  const patients: Row[] = (data["/patients?page=1&pageSize=100"] as unknown as { items?: Row[] })?.items ?? [];
  const charges: Row[] = data["/charges"] ?? [];
  const payments: Row[] = data["/payments"] ?? [];
  const selected = enrollments.find((row) => row.id === enrollmentId);
  const plan = plans.find((row) => row.id === selected?.plan_id);
  const months = Number(plan?.duration_days) === 90 ? 3 : Number(plan?.duration_days) === 180 ? 6 : 1;
  const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + months, 0, 12);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api("/charges", { method: "POST", body: JSON.stringify({ patient_id: selected.patient_id, enrollment_id: selected.id, unit_id: selected.unit_id, description: `${plan?.name ?? "Plano"} · ${month}`, amount_cents: cents(value(form, "amount")), due_at: value(form, "due_at"), coverage_from: `${month}-01`, coverage_to: dateKey(end) }) });
      await reload(); onNotice("Cobrança criada. Selecione o paciente no recebimento para registrar o pagamento.");
    } catch (error) { onNotice(messageOf(error)); } finally { setSaving(false); }
  }
  const rows = charges.filter((charge) => !charge.deleted_at && (charge.coverage_from ? String(charge.coverage_from).slice(0, 7) <= month && String(charge.coverage_to).slice(0, 7) >= month : String(charge.due_at).slice(0, 7) === month));
  return <section className="card">
    <h2>Pagamentos por mês</h2>
    <TextField label="Mês de referência" type="month" value={month} onChange={(event) => { if (event.target.value) onMonth(event.target.value); }} />
    <p>Selecione qualquer mês, inclusive passado. O valor de planos trimestrais e semestrais corresponde ao período completo.</p>
    <div style={{ overflowX: "auto" }}><table><thead><tr><th scope="col">Paciente</th><th scope="col">Plano / período coberto</th><th scope="col">Valor total</th><th scope="col">Recebido</th><th scope="col">Saldo</th><th scope="col">Datas dos pagamentos</th></tr></thead><tbody>
      {rows.map((charge) => <tr key={charge.id}><td>{patients.find((row) => row.id === charge.patient_id)?.name ?? "Paciente"}</td><td>{charge.description}<br />{charge.coverage_from ? `${charge.coverage_from} a ${charge.coverage_to}` : "Período não informado (registro antigo)"}</td><td>{brl(charge.amount_cents)}</td><td>{brl(charge.paid_cents)}</td><td>{charge.status === "cancelled" ? "Cancelada" : brl(charge.amount_cents - charge.paid_cents)}</td><td>{payments.filter((row) => row.charge_id === charge.id && !row.reversed_at).map((row) => `${new Date(row.paid_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${brl(row.amount_cents)}`).join("; ") || "Sem recebimento"}</td></tr>)}
    </tbody></table></div>
    {!rows.length && <p>Nenhuma cobrança para este mês.</p>}
    {canEdit && <form onSubmit={create}>
      <h3>Lançar cobrança do período</h3>
      <SelectField label="Matrícula" value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} required><option value="">Selecione</option>{enrollments.filter((row) => row.status === "active").map((row) => <option key={row.id} value={row.id}>{patients.find((patient) => patient.id === row.patient_id)?.name ?? "Paciente"} · {plans.find((plan) => plan.id === row.plan_id)?.name}</option>)}</SelectField>
      <p>Período: {month}-01 a {dateKey(end)} ({months} meses).</p>
      <TextField key={`${enrollmentId}-${month}`} name="amount" label="Valor do período" type="number" min="0.01" step="0.01" defaultValue={plan ? (Math.max(1, Number(plan.price_cents) - Number(selected?.discount_cents ?? 0) + Number(selected?.surcharge_cents ?? 0)) / 100).toFixed(2) : ""} required />
      <TextField key={month} name="due_at" label="Vencimento" type="date" defaultValue={`${month}-01`} required />
      <button className="btn primary" disabled={saving || !selected}>{saving ? "Salvando…" : "Criar cobrança"}</button>
    </form>}
  </section>;
}
