export type MonthlyPaymentSourceRow = Record<string, unknown>;

export type MonthlyPaymentState = "paid" | "partial" | "overdue" | "pending" | "unbilled" | "cancelled";

export type MonthlyPaymentRow = {
  enrollmentId: string;
  patientId: string;
  patientName: string;
  planName: string;
  planKind: string;
  planDurationDays: number;
  unitId: string;
  dueAt: string;
  /** Null means the enrollment has no determinable commercial amount. */
  amountCents: number | null;
  paidCents: number;
  balanceCents: number;
  chargeId: string;
  coverageFrom: string;
  coverageTo: string;
  state: MonthlyPaymentState;
  expectedAmountCents: number | null;
  discountCents: number;
  surchargeCents: number;
  contractAmountCents: number | null;
  contractFinalAmountCents: number | null;
  contractEffectiveFrom: string;
  enrollmentUpdatedAt: string;
  enrollmentStartsAt: string;
};

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function nextDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function plannedCoverageEnd(month: string, durationDays: unknown) {
  const months = Math.max(1, Math.round(Number(durationDays ?? 30) / 30));
  const start = new Date(`${month}-01T12:00:00`);
  return new Date(start.getFullYear(), start.getMonth() + months, 0).toISOString().slice(0, 10);
}

function matchesMonth(charge: MonthlyPaymentSourceRow, month: string) {
  const { from, to } = monthBounds(month);
  const coverageFrom = String(charge.coverage_from ?? "");
  const coverageTo = String(charge.coverage_to ?? "");
  if (coverageFrom && coverageTo) return coverageFrom <= to && coverageTo >= from;
  return String(charge.due_at ?? "").slice(0, 7) === month;
}

export function buildMonthlyPaymentRows({
  month,
  enrollments,
  patients,
  plans,
  charges,
  terms = [],
}: {
  month: string;
  enrollments: MonthlyPaymentSourceRow[];
  patients: MonthlyPaymentSourceRow[];
  plans: MonthlyPaymentSourceRow[];
  charges: MonthlyPaymentSourceRow[];
  terms?: MonthlyPaymentSourceRow[];
}): MonthlyPaymentRow[] {
  const patientById = new Map(patients.map((row) => [String(row.id), row]));
  const planById = new Map(plans.map((row) => [String(row.id), row]));

  return enrollments
    .filter((enrollment) => !enrollment.deleted_at)
    .filter((enrollment) => !enrollment.starts_at || String(enrollment.starts_at).slice(0, 7) <= month)
    .filter((enrollment) => !enrollment.ends_at || String(enrollment.ends_at) >= monthBounds(month).from
      || charges.some((charge) => !charge.deleted_at && String(charge.enrollment_id) === String(enrollment.id) && matchesMonth(charge, month)))
    .flatMap((enrollment) => {
      const enrollmentId = String(enrollment.id);
      const patientId = String(enrollment.patient_id ?? "");
      const patient = (enrollment.patient as MonthlyPaymentSourceRow | null) ?? patientById.get(patientId) ?? {};
      // /enrollments deliberately embeds a compact plan (name/duration only).  The
      // catalogue response is the only source here that carries price_cents.
      const plan = planById.get(String(enrollment.plan_id)) ?? (enrollment.plan as MonthlyPaymentSourceRow | null) ?? {};
      const matchingCharges = charges.filter((charge) => !charge.deleted_at && String(charge.enrollment_id) === enrollmentId && matchesMonth(charge, month));
      const activeCharges = matchingCharges.filter((c) => c.status !== "cancelled");
      const visibleCharges = activeCharges.length ? activeCharges : matchingCharges.slice(-1);
      const term = terms.filter((t) => String(t.enrollment_id) === enrollmentId && String(t.effective_from) <= `${month}-01`).sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
      const discountCents = Number(term?.discount_cents ?? enrollment.discount_cents ?? 0);
      const surchargeCents = Number(term?.surcharge_cents ?? enrollment.surcharge_cents ?? 0);
      const effectiveFrom = String(enrollment.contract_effective_from ?? "");
      const recurringPrice = term?.base_amount_cents ?? (effectiveFrom && month >= effectiveFrom.slice(0, 7) ? enrollment.contract_amount_cents : null);
      const expectedAmount = recurringPrice === null || recurringPrice === undefined || !Number.isFinite(Number(recurringPrice))
        ? null
        : Number(recurringPrice) - discountCents + surchargeCents;
      const enrollmentStart = String(enrollment.starts_at ?? `${month}-01`);
      const enrollmentEnd = String(enrollment.ends_at ?? plannedCoverageEnd(month, plan.duration_days));
      const plannedFrom = `${month}-01` < enrollmentStart ? enrollmentStart : `${month}-01`;
      const plannedTo = plannedCoverageEnd(month, plan.duration_days) > enrollmentEnd ? enrollmentEnd : plannedCoverageEnd(month, plan.duration_days);

      // A paid charge from a prior month may cover only the first days of this
      // month. Keep that snapshot visible and show the remaining days separately.
      const activeCoverageEnds = activeCharges
        .filter((charge) => charge.coverage_from && charge.coverage_to)
        .map((charge) => String(charge.coverage_to));
      const latestCoverageEnd = activeCoverageEnds.sort().at(-1);
      const uncoveredFrom = Number(plan.duration_days ?? 0) === 30
        && activeCharges.length > 0
        && activeCoverageEnds.length === activeCharges.length
        && latestCoverageEnd && latestCoverageEnd < plannedTo
        ? nextDay(latestCoverageEnd)
        : "";
      const showUnbilledRemainder = uncoveredFrom && uncoveredFrom <= plannedTo;
      const rowsForMonth = visibleCharges.length
        ? showUnbilledRemainder ? [...visibleCharges, undefined] : visibleCharges
        : [undefined];

      return rowsForMonth.map((charge) => {
      // A persisted charge is a financial snapshot and always takes precedence.
      // Do not turn an unknown or invalid expected amount into zero.
      const amountCents = charge ? Number(charge.amount_cents) : expectedAmount === null || expectedAmount < 0 ? null : expectedAmount;
      const paidCents = Number(charge?.paid_cents ?? 0);
      const balanceCents = amountCents === null ? 0 : Math.max(amountCents - paidCents, 0);
      const status = String(charge?.status ?? "");
      const state: MonthlyPaymentState = !charge ? "unbilled"
        : status === "cancelled" ? "cancelled"
          : (amountCents !== null && paidCents >= amountCents) ? "paid"
            : paidCents > 0 ? "partial" : status === "overdue" ? "overdue" : "pending";

      return {
        enrollmentId,
        enrollmentUpdatedAt: String(enrollment.updated_at ?? ""),
        enrollmentStartsAt: String(enrollment.starts_at ?? ""),
        patientId,
        patientName: String(patient.name ?? "Paciente não encontrado"),
        planName: String(plan.name ?? "Plano não encontrado"),
        planKind: String(plan.kind ?? ""),
        planDurationDays: Number(plan.duration_days ?? 0),
        unitId: String(enrollment.unit_id ?? ""),
        dueAt: String(charge?.due_at ?? `${month}-${String(Math.min(Math.max(Number(enrollment.due_day ?? 1), 1), 28)).padStart(2, "0")}`),
        amountCents,
        paidCents,
        balanceCents,
        chargeId: String(charge?.id ?? ""),
        coverageFrom: String(charge?.coverage_from ?? (showUnbilledRemainder ? uncoveredFrom : plannedFrom)),
        coverageTo: String(charge?.coverage_to ?? plannedTo),
        state,
        expectedAmountCents: expectedAmount,
        discountCents,
        surchargeCents,
        contractAmountCents: enrollment.contract_amount_cents === null || enrollment.contract_amount_cents === undefined ? null : Number(enrollment.contract_amount_cents),
        contractFinalAmountCents: enrollment.contract_amount_cents === null || enrollment.contract_amount_cents === undefined
          ? null
          : Number(enrollment.contract_amount_cents) - Number(enrollment.discount_cents ?? 0) + Number(enrollment.surcharge_cents ?? 0),
        contractEffectiveFrom: String(enrollment.contract_effective_from ?? ""),
      };
      });
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName, "pt-BR"));
}
