import { describe, expect, it } from "vitest";
import { buildAvailablePaymentPlans } from "./paymentPlans";

const base = {
  plans: [
    { id: "plan-1", name: "Mensal · 2x por semana" },
    { id: "plan-2", name: "Trimestral" },
  ],
  enrollments: [
    { id: "enrollment-1", patient_id: "patient-1", plan_id: "plan-1", status: "active" },
    { id: "enrollment-2", patient_id: "patient-2", plan_id: "plan-2", status: "active" },
  ],
};

describe("planos disponíveis para recebimento", () => {
  it("mantém somente cobranças abertas ligadas a matrículas ativas", () => {
    const result = buildAvailablePaymentPlans({
      ...base,
      enrollments: [
        ...base.enrollments,
        { id: "enrollment-paused", patient_id: "patient-1", plan_id: "plan-2", status: "paused" },
      ],
      charges: [
        { id: "charge-open", enrollment_id: "enrollment-1", patient_id: "patient-1", amount_cents: 20000, paid_cents: 5000, due_at: "2026-09-10", status: "partial" },
        { id: "charge-paid", enrollment_id: "enrollment-1", patient_id: "patient-1", amount_cents: 20000, paid_cents: 20000, due_at: "2026-08-10", status: "paid" },
        { id: "charge-cancelled", enrollment_id: "enrollment-2", patient_id: "patient-2", amount_cents: 30000, paid_cents: 0, due_at: "2026-09-12", status: "cancelled" },
        { id: "charge-paused", enrollment_id: "enrollment-paused", patient_id: "patient-1", amount_cents: 30000, paid_cents: 0, due_at: "2026-09-12", status: "pending" },
        { id: "charge-loose", patient_id: "patient-1", amount_cents: 1000, paid_cents: 0, due_at: "2026-09-15", status: "pending" },
      ],
    });

    expect(result).toEqual([expect.objectContaining({
      chargeId: "charge-open",
      patientId: "patient-1",
      planName: "Mensal · 2x por semana",
      balanceCents: 15000,
    })]);
  });

  it("mostra uma opção por plano e prioriza a cobrança com vencimento mais antigo", () => {
    const charge = { id: "charge-1", enrollment_id: "enrollment-1", patient_id: "patient-1", amount_cents: 20000, paid_cents: 0, due_at: "2026-09-10", status: "pending" };
    const result = buildAvailablePaymentPlans({
      ...base,
      charges: [
        { ...charge, id: "charge-later", due_at: "2026-10-10" },
        charge,
        charge,
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].chargeId).toBe("charge-1");
  });

  it("não mistura uma cobrança com a matrícula de outra pessoa", () => {
    const result = buildAvailablePaymentPlans({
      ...base,
      charges: [{ id: "charge-1", enrollment_id: "enrollment-1", patient_id: "patient-2", amount_cents: 20000, paid_cents: 0, due_at: "2026-09-10", status: "pending" }],
    });

    expect(result).toEqual([]);
  });
});
