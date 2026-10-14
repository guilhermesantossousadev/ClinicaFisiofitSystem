import { useMemo, useState } from "react";
import { buildMonthlyPaymentRows, type MonthlyPaymentRow } from "../../application/portal/monthlyPaymentControl";
import { api } from "../../infrastructure/http/api";
import { TextareaField, TextField } from "../components/FormPrimitives";
import { type Row, brl, dateKey, messageOf } from "./OperationalShared";

type PaymentFilter = "all" | "paid" | "open" | "unbilled";

function monthLabel(month: string) { return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`)); }
function nextMonth(month: string) { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 7); }
function dateLabel(date: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${date}T12:00:00`)); }
function coverageLabel(row: MonthlyPaymentRow) { const format = (date: string) => new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)).replace(".", ""); return !row.coverageTo || row.coverageFrom.slice(0, 7) === row.coverageTo.slice(0, 7) ? format(row.coverageFrom) : `${format(row.coverageFrom)} → ${format(row.coverageTo)}`; }
function stateLabel(state: MonthlyPaymentRow["state"]) { return ({ paid: "✓ Pago", partial: "Parcial", overdue: "Em aberto", pending: "Em aberto", unbilled: "Sem cobrança", cancelled: "Cancelada" } as const)[state]; }
function stateDescription(row: MonthlyPaymentRow) { if (row.state === "unbilled") return "A cobrança deste período ainda não foi criada."; if (row.state === "paid") return row.coverageFrom.slice(0, 7) === row.coverageTo.slice(0, 7) ? "Recebimento registrado para este período." : "Coberto por pagamento de período anterior."; if (row.state === "partial") return `${brl(row.balanceCents)} ainda pendente.`; return `Vencimento em ${dateLabel(row.dueAt)}.`; }

export function MonthlyPayments({ data, month, onMonth, canEdit, canCorrectChargeAmounts = false, reload, onNotice, onRegisterPayment }: { data: Record<string, Row[]>; month: string; onMonth: (month: string) => void; canEdit: boolean; canCorrectChargeAmounts?: boolean; reload: () => Promise<void>; onNotice: (text: string) => void; onRegisterPayment?: (row: MonthlyPaymentRow) => void }) {
  const [savingEnrollmentId, setSavingEnrollmentId] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const [confirmingRow, setConfirmingRow] = useState<MonthlyPaymentRow | null>(null);
  const [editingCharge, setEditingCharge] = useState<MonthlyPaymentRow | null>(null);
  const [editingContract, setEditingContract] = useState<MonthlyPaymentRow | null>(null);
  const enrollments: Row[] = data["/enrollments"] ?? [];
  const plans: Row[] = data["/plans"] ?? [];
  const patients: Row[] = (data["/patients?page=1&pageSize=100"] as unknown as { items?: Row[] })?.items ?? [];
  const charges: Row[] = data["/charges"] ?? [];
  const rows = useMemo(() => buildMonthlyPaymentRows({ month, enrollments, patients, plans, charges }), [month, enrollments, patients, plans, charges]);
  const filteredRows = rows.filter((row) => (!search.trim() || `${row.patientName} ${row.planName}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))) && (filter === "all" || (filter === "paid" && row.state === "paid") || (filter === "open" && ["pending", "partial", "overdue"].includes(row.state)) || (filter === "unbilled" && row.state === "unbilled")));
  const paidCount = rows.filter((row) => row.state === "paid").length;
  const pendingCount = rows.filter((row) => ["pending", "partial", "overdue"].includes(row.state)).length;
  const unbilledCount = rows.filter((row) => row.state === "unbilled").length;
  const expectedCents = rows.filter((row) => row.state !== "cancelled").reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const receivedCents = rows.filter((row) => row.state !== "cancelled").reduce((sum, row) => sum + row.paidCents, 0);
  const changeMonth = (offset: number) => { const current = new Date(`${month}-01T12:00:00`); current.setMonth(current.getMonth() + offset); onMonth(dateKey(current).slice(0, 7)); };
  async function createCharge(row: MonthlyPaymentRow) { if (savingEnrollmentId) return; if (row.amountCents === null || row.amountCents <= 0) { onNotice(row.amountCents === 0 ? "Este é um plano gratuito; não há cobrança financeira a criar." : "Não foi possível determinar o valor desta matrícula. Revise o plano e o valor contratado antes de criar a cobrança."); setConfirmingRow(null); return; } setSavingEnrollmentId(row.enrollmentId); try { await api("/charges", { method: "POST", body: JSON.stringify({ patient_id: row.patientId, enrollment_id: row.enrollmentId, unit_id: row.unitId, description: `${row.planName} · ${month}`, due_at: row.dueAt, coverage_from: row.coverageFrom, coverage_to: row.coverageTo }) }); await reload(); onNotice("Cobrança criada. O recebimento ainda precisa ser registrado."); setConfirmingRow(null); } catch (error) { onNotice(messageOf(error)); } finally { setSavingEnrollmentId(""); } }
  async function editCharge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCharge?.chargeId || editingCharge.amountCents === null || savingEnrollmentId) return;
    const form = new FormData(event.currentTarget);
    const nextAmountCents = Math.round(Number(String(form.get("amount") ?? "").replace(",", ".")) * 100);
    const reason = String(form.get("reason") ?? "").trim();
    if (!Number.isSafeInteger(nextAmountCents) || nextAmountCents <= 0 || !reason) return;
    if (!window.confirm(`Confirma alterar de ${brl(editingCharge.amountCents)} para ${brl(nextAmountCents)}?`)) return;
    setSavingEnrollmentId(editingCharge.enrollmentId);
    try {
      await api(`/charges/${editingCharge.chargeId}/amount`, { method: "PATCH", body: JSON.stringify({ expected_amount_cents: editingCharge.amountCents, amount_cents: nextAmountCents, reason }) });
      setEditingCharge(null);
      await reload();
      onNotice("Valor da cobrança atualizado.");
    } catch (error) { onNotice(messageOf(error)); }
    finally { setSavingEnrollmentId(""); }
  }
  async function editContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContract || savingEnrollmentId) return;
    const form = new FormData(event.currentTarget);
    const amountCents = Math.round(Number(String(form.get("amount") ?? "").replace(",", ".")) * 100);
    const effectiveMonth = String(form.get("effective_month") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !/^\d{4}-\d{2}$/.test(effectiveMonth) || reason.length < 10) return;
    const effectiveFrom = `${effectiveMonth}-01`;
    if (!window.confirm(`Confirma definir mensalidade recorrente de ${brl(amountCents)} a partir de ${monthLabel(effectiveMonth)}?`)) return;
    setSavingEnrollmentId(editingContract.enrollmentId);
    try {
      await api(`/enrollments/${editingContract.enrollmentId}/contract-amount`, { method: "PATCH", body: JSON.stringify({ expected_amount_cents: editingContract.contractAmountCents, amount_cents: amountCents, effective_from: effectiveFrom, reason }) });
      setEditingContract(null);
      await reload();
      onNotice("Valor mensal contratado salvo. Próximas cobranças usarão esse valor desde a vigência informada.");
    } catch (error) { onNotice(messageOf(error)); }
    finally { setSavingEnrollmentId(""); }
  }
  return <section className="plans-control" aria-labelledby="monthly-payments-title">
    <header className="plans-control-header"><div><p className="eyebrow">PACIENTES / CONTROLE DE PLANOS</p><h1 id="monthly-payments-title">Controle de Planos</h1><p>Acompanhe cobranças, pagamentos e planos ativos dos pacientes.</p></div><div className="reference-month" aria-label="Mês de referência"><button type="button" className="month-arrow" onClick={() => changeMonth(-1)} aria-label="Mês anterior">‹</button><TextField fieldClassName="month-input" label="Mês de referência" type="month" value={month} onChange={(event) => event.target.value && onMonth(event.target.value)} /><strong aria-live="polite">{monthLabel(month)}</strong><button type="button" className="month-arrow" onClick={() => changeMonth(1)} aria-label="Próximo mês">›</button><button type="button" className="btn secondary month-current" onClick={() => onMonth(dateKey(new Date()).slice(0, 7))}>Mês atual</button></div></header>
    <div className="plans-summary" aria-label="Resumo do período"><Summary label="Planos ativos" value={rows.length} /><Summary label="Pagos" value={paidCount} tone="paid" /><Summary label="Em aberto" value={pendingCount} tone="open" /><Summary label="Sem cobrança" value={unbilledCount} /><Summary label="Previsto" value={brl(expectedCents)} financial /><Summary label="Recebido" value={brl(receivedCents)} tone="paid" financial /><Summary label="Pendente" value={brl(Math.max(expectedCents - receivedCents, 0))} tone="open" financial /></div>
    <div className="plans-filter-bar"><TextField fieldClassName="plans-search" label="Buscar paciente ou plano" type="search" placeholder="Buscar paciente ou plano..." value={search} onChange={(event) => setSearch(event.target.value)} /><div className="payment-tabs" role="tablist" aria-label="Situação financeira">{([['all', 'Todos', rows.length], ['paid', 'Pagos', paidCount], ['open', 'Em aberto', pendingCount], ['unbilled', 'Sem cobrança', unbilledCount]] as const).map(([value, label, count]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>)}</div></div>
    <div className="plans-list" aria-live="polite">{filteredRows.map((row) => <PatientPlanRow key={row.enrollmentId} row={row} canEdit={canEdit} canCorrectChargeAmounts={canCorrectChargeAmounts} saving={savingEnrollmentId === row.enrollmentId} onCreate={() => setConfirmingRow(row)} onEditCharge={() => setEditingCharge(row)} onEditContract={() => setEditingContract(row)} onRegister={() => onRegisterPayment?.(row)} />)}{!filteredRows.length && <div className="plans-empty"><strong>Nenhum plano encontrado</strong><span>Não existem matrículas que correspondam aos filtros selecionados.</span>{(search || filter !== "all") && <button type="button" className="btn secondary" onClick={() => { setSearch(""); setFilter("all"); }}>Limpar filtros</button>}</div>}</div>
    {editingContract && <div className="edit-dialog-backdrop" role="presentation"><section className="edit-dialog charge-confirmation" role="dialog" aria-modal="true" aria-labelledby="edit-contract-title"><div className="edit-dialog-header"><div><p className="eyebrow">CONDIÇÃO CONTRATUAL</p><h2 id="edit-contract-title">Definir valor mensal recorrente</h2><p>{editingContract.patientName} · {editingContract.planName}</p></div><button type="button" className="dialog-close" onClick={() => setEditingContract(null)} aria-label="Fechar" disabled={Boolean(savingEnrollmentId)}>×</button></div><form className="modal-form" onSubmit={(event) => void editContract(event)}><p>Informe o valor final da mensalidade. O sistema considera o desconto e o adicional atuais desta matrícula; o preço global do plano não muda. Se já existir uma cobrança futura, ajuste-a primeiro para este mesmo valor.</p>{editingContract.contractFinalAmountCents !== null && <p>Valor final atual: <strong>{brl(editingContract.contractFinalAmountCents)}</strong>{editingContract.contractEffectiveFrom ? ` desde ${monthLabel(editingContract.contractEffectiveFrom.slice(0, 7))}` : ""}.</p>}<TextField label="Mensalidade final (R$)" name="amount" type="number" min="0.01" step="0.01" defaultValue={((editingContract.amountCents ?? 0) / 100).toFixed(2)} required /><TextField label="Vigente a partir de" name="effective_month" type="month" min={month} defaultValue={nextMonth(month)} required /><TextareaField label="Justificativa" name="reason" minLength={10} maxLength={1000} required hint="A mudança ficará registrada na auditoria financeira." /><div className="edit-dialog-actions"><button type="button" className="btn secondary" onClick={() => setEditingContract(null)} disabled={Boolean(savingEnrollmentId)}>Cancelar</button><button type="submit" className="btn primary" disabled={Boolean(savingEnrollmentId)}>{savingEnrollmentId ? "Salvando…" : "Confirmar valor recorrente"}</button></div></form></section></div>}
    {editingCharge && editingCharge.amountCents !== null && <div className="edit-dialog-backdrop" role="presentation"><section className="edit-dialog charge-confirmation" role="dialog" aria-modal="true" aria-labelledby="edit-charge-title"><div className="edit-dialog-header"><div><p className="eyebrow">AJUSTE DE COBRANÇA</p><h2 id="edit-charge-title">Editar valor da cobrança</h2><p>{editingCharge.patientName} · {editingCharge.planName} · {monthLabel(month)}</p></div><button type="button" className="dialog-close" onClick={() => setEditingCharge(null)} aria-label="Fechar" disabled={Boolean(savingEnrollmentId)}>×</button></div><form className="modal-form" onSubmit={(event) => void editCharge(event)}><p>Valor atual: <strong>{brl(editingCharge.amountCents)}</strong>. A gravação só será aceita se continuar sem recebimentos.</p><TextField label="Novo valor (R$)" name="amount" type="number" min="0.01" step="0.01" defaultValue={(editingCharge.amountCents / 100).toFixed(2)} required /><TextareaField label="Justificativa" name="reason" minLength={10} maxLength={1000} required hint="Informe o motivo; ficará registrado na auditoria financeira." /><div className="edit-dialog-actions"><button type="button" className="btn secondary" onClick={() => setEditingCharge(null)} disabled={Boolean(savingEnrollmentId)}>Cancelar</button><button type="submit" className="btn primary" disabled={Boolean(savingEnrollmentId)}>{savingEnrollmentId ? "Salvando…" : "Confirmar correção"}</button></div></form></section></div>}
    {confirmingRow && <div className="edit-dialog-backdrop" role="presentation"><section className="edit-dialog charge-confirmation" role="dialog" aria-modal="true" aria-labelledby="create-charge-title"><div className="edit-dialog-header"><div><p className="eyebrow">NOVA COBRANÇA</p><h2 id="create-charge-title">Criar cobrança de {monthLabel(month)}?</h2></div><button type="button" className="dialog-close" onClick={() => setConfirmingRow(null)} aria-label="Fechar">×</button></div><div className="charge-confirmation-content"><Info label="Paciente" value={confirmingRow.patientName} /><Info label="Plano" value={confirmingRow.planName} /><Info label="Cobertura" value={coverageLabel(confirmingRow)} /><Info label="Valor" value={confirmingRow.amountCents === null ? "Valor indisponível" : brl(confirmingRow.amountCents)} /></div><div className="edit-dialog-actions"><button type="button" className="btn secondary" onClick={() => setConfirmingRow(null)}>Cancelar</button><button type="button" className="btn primary" disabled={Boolean(savingEnrollmentId) || confirmingRow.amountCents === null || confirmingRow.amountCents <= 0} onClick={() => void createCharge(confirmingRow)}>{savingEnrollmentId ? "Criando…" : "Criar cobrança"}</button></div></section></div>}
  </section>;
}
function Summary({ label, value, tone = "", financial = false }: { label: string; value: string | number; tone?: string; financial?: boolean }) { return <div className={`plans-summary-card ${tone}`}><span>{label}</span><strong className={financial ? "money" : ""}>{value}</strong></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function PatientPlanRow({ row, canEdit, canCorrectChargeAmounts, saving, onCreate, onEditCharge, onEditContract, onRegister }: { row: MonthlyPaymentRow; canEdit: boolean; canCorrectChargeAmounts: boolean; saving: boolean; onCreate: () => void; onEditCharge: () => void; onEditContract: () => void; onRegister: () => void }) {
  const action = row.state === "unbilled" && canEdit
    ? <button type="button" className="btn primary" disabled={saving || row.amountCents === null || row.amountCents <= 0} onClick={onCreate}>{saving ? "Criando…" : row.amountCents === null ? "Valor indisponível" : row.amountCents === 0 ? "Plano gratuito" : "Criar cobrança"}</button>
    : ["pending", "overdue"].includes(row.state) && (canEdit || canCorrectChargeAmounts)
      ? <div className="patient-plan-actions">{canCorrectChargeAmounts && <button type="button" className="btn secondary" disabled={saving} onClick={onEditCharge}>Editar valor da cobrança</button>}{canEdit && <button type="button" className="btn primary" disabled={saving} onClick={onRegister}>Registrar recebimento</button>}</div>
      : row.state === "partial" && canEdit
        ? <div className="patient-plan-actions">{canCorrectChargeAmounts && <span className="quiet-action">Ajuste financeiro necessário</span>}<button type="button" className="btn primary" onClick={onRegister}>Registrar recebimento</button></div>
        : row.state === "paid" ? <span className="quiet-action">Recebimento registrado</span> : null;
  const displayAmount = row.amountCents === null ? "Valor indisponível" : brl(row.amountCents);
  return <article className="patient-plan-row">
    <div className="patient-plan-main"><div className="patient-plan-name"><strong>{row.patientName}</strong><span>{row.planName}</span></div><div className="patient-plan-coverage"><span>Cobertura</span><strong>{coverageLabel(row)}</strong>{row.state === "paid" && row.coverageFrom.slice(0, 7) !== row.coverageTo.slice(0, 7) && <small>Coberto por pagamento do período inicial.</small>}</div></div>
    <div className="patient-plan-financial"><div><span className={`plan-status payment-status-${row.state}`}>{stateLabel(row.state)}</span><small>{stateDescription(row)}</small></div><div className="patient-plan-value"><span>Valor</span><strong>{displayAmount}</strong>{row.state !== "paid" && row.paidCents > 0 && <small>{brl(row.paidCents)} recebido</small>}</div>{action}{canCorrectChargeAmounts && row.planKind === "monthly" && <button type="button" className="btn secondary" disabled={saving} onClick={onEditContract}>Definir valor mensal</button>}</div>
    <details className="patient-plan-details"><summary>Ver detalhes <span aria-hidden="true">⌄</span></summary><div><Info label="Plano" value={row.planName} /><Info label="Cobertura" value={coverageLabel(row)} /><Info label="Vencimento" value={dateLabel(row.dueAt)} /><Info label="Cobrança" value={row.chargeId ? `#${row.chargeId}` : "Ainda não criada"} />{!row.chargeId && <Info label="Valor esperado" value={displayAmount} />}{row.chargeId && <Info label="Saldo" value={brl(row.balanceCents)} />}</div></details>
  </article>;
}
