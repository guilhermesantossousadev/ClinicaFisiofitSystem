export type PaymentPlanSourceRow = Record<string, unknown>;

export type AvailablePaymentPlan = {
  chargeId: string;
  patientId: string;
  enrollmentId: string;
  planId: string;
  planName: string;
  dueAt: string;
  balanceCents: number;
  status: string;
};

export function buildAvailablePaymentPlans({
  charges,
  enrollments,
  plans,
}: {
  charges: PaymentPlanSourceRow[];
  enrollments: PaymentPlanSourceRow[];
  plans: PaymentPlanSourceRow[];
}): AvailablePaymentPlan[] {
  const enrollmentById = new Map(enrollments
    .filter((row) => !row.deleted_at && row.status === "active")
    .map((row) => [String(row.id), row]));
  const planById = new Map(plans
    .filter((row) => !row.deleted_at)
    .map((row) => [String(row.id), row]));
  const eligible = charges.flatMap((charge) => {
    const chargeId = String(charge.id ?? "");
    const enrollment = enrollmentById.get(String(charge.enrollment_id ?? ""));
    const plan = enrollment ? planById.get(String(enrollment.plan_id ?? "")) : undefined;
    const balanceCents = Number(charge.amount_cents ?? 0) - Number(charge.paid_cents ?? 0);
    const patientId = String(enrollment?.patient_id ?? "");
    const chargePatientId = String(charge.patient_id ?? patientId);

    if (
      !chargeId
      || charge.deleted_at
      || charge.status === "cancelled"
      || balanceCents <= 0
      || !enrollment
      || !plan
      || !patientId
      || chargePatientId !== patientId
    ) return [];

    return [{
      chargeId,
      patientId,
      enrollmentId: String(enrollment.id),
      planId: String(plan.id),
      planName: String(plan.name ?? "Plano sem nome"),
      dueAt: String(charge.due_at ?? ""),
      balanceCents,
      status: String(charge.status ?? "pending"),
    }];
  }).sort((a, b) =>
    a.patientId.localeCompare(b.patientId)
    || a.dueAt.localeCompare(b.dueAt)
    || a.planName.localeCompare(b.planName, "pt-BR"),
  );

  const seenChargeIds = new Set<string>();
  const seenEnrollmentIds = new Set<string>();
  return eligible.filter((row) => {
    if (seenChargeIds.has(row.chargeId) || seenEnrollmentIds.has(row.enrollmentId)) return false;
    seenChargeIds.add(row.chargeId);
    seenEnrollmentIds.add(row.enrollmentId);
    return true;
  });
}
