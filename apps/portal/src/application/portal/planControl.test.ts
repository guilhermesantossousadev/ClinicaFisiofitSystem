import { describe, expect, it } from "vitest";
import { buildPlanControlRows, renewalCopy } from "./planControl";

const base = {
  patients: [{ id: "patient-1", name: "Ana", phone: "11999999999" }],
  plans: [{ id: "plan-1", name: "Mensal · 2x por semana", duration_days: 30 }],
  enrollments: [{ id: "enrollment-1", patient_id: "patient-1", plan_id: "plan-1", starts_at: "2026-08-01", status: "active" }],
};

describe("controle de planos", () => {
  it("infere a renovação pela duração e mostra pagamento quitado", () => {
    const rows = buildPlanControlRows({
      ...base,
      charges: [{ id: "charge-1", enrollment_id: "enrollment-1", amount_cents: 20000, paid_cents: 20000, due_at: "2026-08-05", status: "paid" }],
      payments: [{ charge_id: "charge-1", paid_at: "2026-08-04T12:00:00Z" }],
      today: new Date(2026, 7, 16),
    });

    expect(rows[0]).toMatchObject({ patientName: "Ana", renewsAt: "2026-08-31", daysToRenewal: 15, paymentState: "paid" });
    expect(rows[0].lastPaidAt).toBe("2026-08-04T12:00:00Z");
  });

  it("prioriza a data final informada e identifica cobrança marcada como vencida", () => {
    const rows = buildPlanControlRows({
      ...base,
      enrollments: [{ ...base.enrollments[0], ends_at: "2026-08-10" }],
      charges: [{ id: "charge-1", enrollment_id: "enrollment-1", amount_cents: 20000, paid_cents: 5000, due_at: "2026-08-05", status: "overdue" }],
      payments: [],
      today: new Date(2026, 7, 16),
    });

    expect(rows[0]).toMatchObject({ daysToRenewal: -6, renewalState: "expired", paymentState: "overdue" });
    expect(renewalCopy(rows[0].daysToRenewal)).toBe("Vencido há 6 dias");
  });

  it("preserva o status cancelado e expõe a cobrança editável", () => {
    const rows = buildPlanControlRows({
      ...base,
      charges: [{ id: "charge-1", enrollment_id: "enrollment-1", amount_cents: 20000, paid_cents: 0, due_at: "2026-08-05", status: "cancelled" }],
      payments: [],
      today: new Date(2026, 7, 16),
    });

    expect(rows[0]).toMatchObject({ chargeId: "charge-1", paymentState: "cancelled" });
  });

  it("usa o paciente e o plano associados à matrícula mesmo fora da página de pacientes", () => {
    const rows = buildPlanControlRows({
      enrollments: [{
        ...base.enrollments[0],
        patient: { id: "patient-1", name: "Beatriz", phone: "11988887777" },
        plan: { id: "plan-1", name: "Trimestral", duration_days: 90, sessions_included: 24 },
      }],
      patients: [],
      plans: [],
      charges: [],
      payments: [],
      today: new Date(2026, 7, 16),
    });

    expect(rows[0]).toMatchObject({
      patientName: "Beatriz",
      patientPhone: "11988887777",
      planName: "Trimestral",
      sessionsIncluded: 24,
      renewsAt: "2026-10-30",
    });
  });
});
