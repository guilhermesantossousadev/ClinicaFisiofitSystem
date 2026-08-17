export type PlanControlSourceRow = Record<string, unknown>;

export type PaymentState = "paid" | "partial" | "overdue" | "pending" | "cancelled" | "uncharged";
export type RenewalState = "expired" | "due-soon" | "current" | "unknown";

export type PlanControlRow = {
  id: string;
  patientName: string;
  patientPhone: string;
  planName: string;
  sessionsUsed: number;
  sessionsIncluded: number | null;
  enrollmentStatus: string;
  startsAt: string;
  renewsAt: string;
  daysToRenewal: number | null;
  renewalState: RenewalState;
  paymentState: PaymentState;
  chargeId: string;
  amountCents: number;
  paidCents: number;
  lastPaidAt: string;
};

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function inferredRenewalDate(startsAt: string, durationDays: number) {
  if (!startsAt || !durationDays) return "";
  const date = dateOnly(startsAt);
  date.setDate(date.getDate() + durationDays);
  return dateKey(date);
}

function daysBetween(from: Date, toDate: string) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((dateOnly(toDate).getTime() - start.getTime()) / 86_400_000);
}

export function buildPlanControlRows({
  enrollments,
  patients,
  plans,
  charges,
  payments,
  today = new Date(),
}: {
  enrollments: PlanControlSourceRow[];
  patients: PlanControlSourceRow[];
  plans: PlanControlSourceRow[];
  charges: PlanControlSourceRow[];
  payments: PlanControlSourceRow[];
  today?: Date;
}): PlanControlRow[] {
  const patientById = new Map(patients.map((row) => [String(row.id), row]));
  const planById = new Map(plans.map((row) => [String(row.id), row]));
  const paymentsByCharge = new Map<string, PlanControlSourceRow[]>();

  for (const payment of payments) {
    if (payment.reversed_at) continue;
    const chargeId = String(payment.charge_id ?? "");
    paymentsByCharge.set(chargeId, [...(paymentsByCharge.get(chargeId) ?? []), payment]);
  }

  return enrollments
    .filter((enrollment) => !enrollment.deleted_at && enrollment.status !== "reversed")
    .map((enrollment) => {
      const patient = patientById.get(String(enrollment.patient_id)) ?? {};
      const plan = planById.get(String(enrollment.plan_id)) ?? {};
      const enrollmentCharges = charges.filter((charge) =>
        !charge.deleted_at && String(charge.enrollment_id) === String(enrollment.id),
      );
      const primaryCharge = [...enrollmentCharges].sort((a, b) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      ).at(-1);
      const amountCents = enrollmentCharges.reduce((sum, charge) => sum + Number(charge.amount_cents ?? 0), 0);
      const paidCents = enrollmentCharges.reduce((sum, charge) => sum + Number(charge.paid_cents ?? 0), 0);
      const paymentDates = enrollmentCharges.flatMap((charge) =>
        (paymentsByCharge.get(String(charge.id)) ?? []).map((payment) => String(payment.paid_at ?? "")),
      ).filter(Boolean).sort();
      const primaryStatus = String(primaryCharge?.status ?? "");
      const paymentState: PaymentState = amountCents === 0
        ? "uncharged"
        : primaryStatus === "cancelled"
          ? "cancelled"
          : primaryStatus === "paid" || paidCents >= amountCents
            ? "paid"
            : primaryStatus === "overdue"
              ? "overdue"
              : primaryStatus === "partial" || paidCents > 0
                ? "partial"
                : "pending";
      const startsAt = String(enrollment.starts_at ?? "");
      const renewsAt = String(enrollment.ends_at ?? "")
        || inferredRenewalDate(startsAt, Number(plan.duration_days ?? 0));
      const daysToRenewal = renewsAt ? daysBetween(today, renewsAt) : null;
      const renewalState: RenewalState = daysToRenewal == null
        ? "unknown"
        : daysToRenewal < 0
          ? "expired"
          : daysToRenewal <= 7
            ? "due-soon"
            : "current";

      return {
        id: String(enrollment.id),
        patientName: String(patient.name ?? "Paciente não encontrado"),
        patientPhone: String(patient.phone ?? ""),
        planName: String(plan.name ?? "Plano não encontrado"),
        sessionsUsed: Number(enrollment.sessions_used ?? 0),
        sessionsIncluded: plan.sessions_included == null ? null : Number(plan.sessions_included),
        enrollmentStatus: String(enrollment.status ?? "active"),
        startsAt,
        renewsAt,
        daysToRenewal,
        renewalState,
        paymentState,
        chargeId: String(primaryCharge?.id ?? ""),
        amountCents,
        paidCents,
        lastPaidAt: paymentDates.at(-1) ?? "",
      };
    })
    .sort((a, b) => {
      if (!a.renewsAt) return 1;
      if (!b.renewsAt) return -1;
      return a.renewsAt.localeCompare(b.renewsAt) || a.patientName.localeCompare(b.patientName, "pt-BR");
    });
}

export function renewalCopy(days: number | null) {
  if (days == null) return "Data não informada";
  if (days === 0) return "Renova hoje";
  if (days === 1) return "Falta 1 dia";
  if (days > 1) return `Faltam ${days} dias`;
  if (days === -1) return "Vencido há 1 dia";
  return `Vencido há ${Math.abs(days)} dias`;
}
