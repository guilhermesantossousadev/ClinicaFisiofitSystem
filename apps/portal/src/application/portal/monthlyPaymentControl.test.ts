import { describe, expect, it } from "vitest";
import { buildMonthlyPaymentRows } from "./monthlyPaymentControl";

const base = {
  patients: [{ id: "patient-1", name: "Ana" }],
  plans: [{ id: "plan-1", name: "Mensal", price_cents: 20000 }],
  enrollments: [{ id: "enrollment-1", patient_id: "patient-1", plan_id: "plan-1", unit_id: "unit-1", starts_at: "2026-08-01", due_day: 5, status: "active" }],
};

describe("controle mensal de pagamentos", () => {
  it("mostra matrícula sem cobrança como pendente de lançamento no mês selecionado", () => {
    const rows = buildMonthlyPaymentRows({ ...base, charges: [], month: "2026-09" });
    expect(rows).toEqual([expect.objectContaining({ patientName: "Ana", state: "unbilled", amountCents: 20000, dueAt: "2026-09-05" })]);
  });

  it("não usa uma quitação antiga como pagamento do período atual", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-09",
      charges: [{ id: "charge-aug", enrollment_id: "enrollment-1", amount_cents: 20000, paid_cents: 20000, status: "paid", due_at: "2026-08-05", coverage_from: "2026-08-01", coverage_to: "2026-08-31" }],
    });
    expect(rows[0]).toMatchObject({ state: "unbilled", chargeId: "" });
  });

  it("reconhece a cobrança quitada que cobre o mês", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-09",
      charges: [{ id: "charge-quarter", enrollment_id: "enrollment-1", amount_cents: 60000, paid_cents: 60000, status: "paid", due_at: "2026-08-05", coverage_from: "2026-08-01", coverage_to: "2026-10-31" }],
    });
    expect(rows[0]).toMatchObject({ state: "paid", chargeId: "charge-quarter", balanceCents: 0 });
  });
});
