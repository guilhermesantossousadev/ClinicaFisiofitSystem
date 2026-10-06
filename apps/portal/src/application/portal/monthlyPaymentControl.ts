export type MonthlyPaymentSourceRow = Record<string, unknown>;

export type MonthlyPaymentState = "paid" | "partial" | "overdue" | "pending" | "unbilled" | "cancelled";

export type MonthlyPaymentRow = {
  enrollmentId: string;
  patientId: string;
  patientName: string;
  planName: string;
  unitId: string;
  dueAt: string;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  chargeId: string;
  coverageFrom: string;
  coverageTo: string;
  state: MonthlyPaymentState;
};

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
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
}: {
  month: string;
  enrollments: MonthlyPaymentSourceRow[];
  patients: MonthlyPaymentSourceRow[];
  plans: MonthlyPaymentSourceRow[];
  charges: MonthlyPaymentSourceRow[];
}): MonthlyPaymentRow[] {
  const patientById = new Map(patients.map((row) => [String(row.id), row]));
  const planById = new Map(plans.map((row) => [String(row.id), row]));

  return enrollments
    .filter((enrollment) => enrollment.status === "active" && !enrollment.deleted_at)
    .filter((enrollment) => !enrollment.starts_at || String(enrollment.starts_at).slice(0, 7) <= month)
    .map((enrollment) => {
      const enrollmentId = String(enrollment.id);
      const patientId = String(enrollment.patient_id ?? "");
      const patient = (enrollment.patient as MonthlyPaymentSourceRow | null) ?? patientById.get(patientId) ?? {};
      const plan = (enrollment.plan as MonthlyPaymentSourceRow | null) ?? planById.get(String(enrollment.plan_id)) ?? {};
      const matchingCharges = charges.filter((charge) => !charge.deleted_at && String(charge.enrollment_id) === enrollmentId && matchesMonth(charge, month));
      const charge = [...matchingCharges].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))).at(0);
      const amountCents = Number(charge?.amount_cents ?? Math.max(0, Number(plan.price_cents ?? 0) - Number(enrollment.discount_cents ?? 0) + Number(enrollment.surcharge_cents ?? 0)));
      const paidCents = Number(charge?.paid_cents ?? 0);
      const balanceCents = Math.max(amountCents - paidCents, 0);
      const status = String(charge?.status ?? "");
      const state: MonthlyPaymentState = !charge ? "unbilled"
        : status === "cancelled" ? "cancelled"
          : paidCents >= amountCents || status === "paid" ? "paid"
            : status === "overdue" ? "overdue"
              : paidCents > 0 || status === "partial" ? "partial" : "pending";

      return {
        enrollmentId,
        patientId,
        patientName: String(patient.name ?? "Paciente não encontrado"),
        planName: String(plan.name ?? "Plano não encontrado"),
        unitId: String(enrollment.unit_id ?? ""),
        dueAt: String(charge?.due_at ?? `${month}-${String(Math.min(Math.max(Number(enrollment.due_day ?? 1), 1), 28)).padStart(2, "0")}`),
        amountCents,
        paidCents,
        balanceCents,
        chargeId: String(charge?.id ?? ""),
        coverageFrom: String(charge?.coverage_from ?? `${month}-01`),
        coverageTo: String(charge?.coverage_to ?? ""),
        state,
      };
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName, "pt-BR"));
}
