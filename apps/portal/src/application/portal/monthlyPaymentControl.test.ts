import { describe, expect, it } from "vitest";
import { buildMonthlyPaymentRows } from "./monthlyPaymentControl";

const base = {
  patients: [{ id: "patient-1", name: "Ana" }],
  plans: [{ id: "plan-1", name: "Mensal", price_cents: 20000 }],
  enrollments: [{ id: "enrollment-1", patient_id: "patient-1", plan_id: "plan-1", unit_id: "unit-1", starts_at: "2026-08-01", due_day: 5, status: "active", contract_amount_cents: 20000, contract_effective_from: "2026-08-01" }],
};

describe("controle mensal de pagamentos", () => {
  it("mostra matrícula hoje expirada sem cobrança no mês em que vigorava", () => {
    const enrollment = { ...base.enrollments[0], status: "expired", ends_at: "2026-09-30" };
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [], month: "2026-09" })[0]).toMatchObject({ state: "unbilled", enrollmentId: enrollment.id });
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [], month: "2026-10" })).toEqual([]);
  });

  it("respeita o início da matrícula e mantém a cobrança histórica", () => {
    const enrollment = { ...base.enrollments[0], status: "paused", starts_at: "2026-10-01" };
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [], month: "2026-09" })).toEqual([]);
    const historical = { ...enrollment, starts_at: "2026-08-01", ends_at: "2026-09-30" };
    const charge = { id: "september", enrollment_id: historical.id, amount_cents: 20000, paid_cents: 20000, status: "paid", due_at: "2026-09-05", coverage_from: "2026-09-01", coverage_to: "2026-09-30" };
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [historical], charges: [charge], month: "2026-09" })[0]).toMatchObject({ state: "paid", chargeId: "september" });
  });

  it("mostra matrícula sem cobrança como pendente de lançamento no mês selecionado", () => {
    const rows = buildMonthlyPaymentRows({ ...base, charges: [], month: "2026-09" });
    expect(rows).toEqual([expect.objectContaining({ patientName: "Ana", state: "unbilled", amountCents: 20000, dueAt: "2026-09-05" })]);
  });

  it("usa o snapshot contratado quando a matrícula traz apenas o resumo do plano", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-10",
      enrollments: [{ ...base.enrollments[0], plan: { id: "plan-1", name: "Mensal", duration_days: 30 } }],
      charges: [],
    });
    expect(rows[0]).toMatchObject({ state: "unbilled", amountCents: 20000, coverageFrom: "2026-10-01", coverageTo: "2026-10-31" });
  });

  it("usa o valor base individual desde a vigência contratual e preserva desconto e adicional", () => {
    const enrollment = { ...base.enrollments[0], contract_amount_cents: 22000, contract_effective_from: "2026-10-01", discount_cents: 2000, surcharge_cents: 500 };
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [], month: "2026-09" })[0].amountCents).toBe(null);
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [], month: "2026-10" })[0].amountCents).toBe(20500);
  });

  it("não representa preço ausente como zero", () => {
    const rows = buildMonthlyPaymentRows({ ...base, plans: [{ id: "plan-1", name: "Mensal" }], enrollments: [{ ...base.enrollments[0], contract_amount_cents: undefined }], charges: [], month: "2026-09" });
    expect(rows[0]).toMatchObject({ state: "unbilled", amountCents: null, balanceCents: 0 });
  });

  it("limita a cobertura exibida à vigência da matrícula", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-09",
      enrollments: [{ ...base.enrollments[0], starts_at: "2026-09-10", ends_at: "2026-09-20" }],
      charges: [],
    });
    expect(rows[0]).toMatchObject({ coverageFrom: "2026-09-10", coverageTo: "2026-09-20" });
    expect(buildMonthlyPaymentRows({ ...base, month: "2026-10", enrollments: [{ ...base.enrollments[0], ends_at: "2026-09-30" }], charges: [] })).toEqual([]);
  });

  it("preserva o valor comercial e a cobertura trimestral, sem multiplicar o preço", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-10",
      plans: [{ id: "plan-1", name: "Trimestral · 2x por semana", price_cents: 90000, duration_days: 90 }],
      enrollments: [{ ...base.enrollments[0], contract_amount_cents: 90000 }],
      charges: [],
    });
    expect(rows[0]).toMatchObject({ amountCents: 90000, coverageFrom: "2026-10-01", coverageTo: "2026-12-31" });
  });

  it("preserva o valor comercial e a cobertura semestral", () => {
    const rows = buildMonthlyPaymentRows({
      ...base,
      month: "2026-10",
      plans: [{ id: "plan-1", name: "Semestral · 2x por semana", price_cents: 170000, duration_days: 180 }],
      enrollments: [{ ...base.enrollments[0], contract_amount_cents: 170000 }],
      charges: [],
    });
    expect(rows[0]).toMatchObject({ amountCents: 170000, coverageTo: "2027-03-31" });
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

  it("usa o valor persistido corrigido para totais e saldo, sem alterar outra matrícula ou mês", () => {
    const rows = buildMonthlyPaymentRows({
      month: "2026-09",
      enrollments: [
        ...base.enrollments,
        { id: "enrollment-2", patient_id: "patient-2", plan_id: "plan-1", unit_id: "unit-1", starts_at: "2026-08-01", due_day: 5, status: "active", contract_amount_cents: 20000, contract_effective_from: "2026-08-01" },
      ],
      patients: [...base.patients, { id: "patient-2", name: "Bia" }],
      plans: base.plans,
      charges: [
        { id: "corrected-charge", enrollment_id: "enrollment-1", amount_cents: 12500, paid_cents: 0, status: "pending", due_at: "2026-09-05", coverage_from: "2026-09-01", coverage_to: "2026-09-30" },
        { id: "next-month", enrollment_id: "enrollment-1", amount_cents: 20000, paid_cents: 0, status: "pending", due_at: "2026-10-05", coverage_from: "2026-10-01", coverage_to: "2026-10-31" },
      ],
    });
    expect(rows.find((row) => row.enrollmentId === "enrollment-1")).toMatchObject({ chargeId: "corrected-charge", amountCents: 12500, balanceCents: 12500 });
    expect(rows.find((row) => row.enrollmentId === "enrollment-2")).toMatchObject({ state: "unbilled", amountCents: 20000 });
  });

  it("mantém pago somente durante a cobertura semestral", () => {
    const charges = [{ id: "charge-semester", enrollment_id: "enrollment-1", amount_cents: 120000, paid_cents: 120000, status: "paid", due_at: "2026-09-05", coverage_from: "2026-09-01", coverage_to: "2027-02-28" }];
    expect(buildMonthlyPaymentRows({ ...base, month: "2027-02", charges })[0]).toMatchObject({ state: "paid", chargeId: "charge-semester" });
    expect(buildMonthlyPaymentRows({ ...base, month: "2027-03", charges })[0]).toMatchObject({ state: "unbilled", chargeId: "" });
  });
});

describe("homologação de preço contratado e recebimentos", () => {
  it("266 devido e 220 recebido aparecem divergentes até ajuste explícito; após ajuste o saldo é zero", () => {
    const enrollment = { ...base.enrollments[0], contract_amount_cents: 22000 };
    const charge = { id: "c", enrollment_id: enrollment.id, amount_cents: 26600, paid_cents: 22000, status: "partial", due_at: "2026-10-05", coverage_from: "2026-10-01", coverage_to: "2026-10-31" };
    const before = buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [charge], month: "2026-10" })[0];
    expect(before).toMatchObject({ amountCents: 26600, expectedAmountCents: 22000, paidCents: 22000, balanceCents: 4600, state: "partial" });
    const after = buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], charges: [{ ...charge, amount_cents: 22000, status: "paid" }], month: "2026-10" })[0];
    expect(after).toMatchObject({ amountCents: 22000, paidCents: 22000, balanceCents: 0, state: "paid" });
  });
  it("edição de catálogo não muda preço contratado e termos respeitam vigência", () => {
    const enrollment = { ...base.enrollments[0], contract_amount_cents: 24000, contract_effective_from: "2026-12-01" };
    const terms = [{ enrollment_id: enrollment.id, effective_from: "2026-08-01", base_amount_cents: 22000, discount_cents: 0, surcharge_cents: 0 }, { enrollment_id: enrollment.id, effective_from: "2026-12-01", base_amount_cents: 24000, discount_cents: 0, surcharge_cents: 0 }];
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], plans: [{ ...base.plans[0], price_cents: 99999 }], terms, charges: [], month: "2026-10" })[0].amountCents).toBe(22000);
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [enrollment], terms, charges: [], month: "2026-12" })[0].amountCents).toBe(24000);
  });
  it("não esconde cobranças múltiplas nem confunde status paid sem recebimento com quitação", () => {
    const charges = [{ id: "c1", enrollment_id: "enrollment-1", amount_cents: 22000, paid_cents: 0, status: "paid", due_at: "2026-10-05" }, { id: "c2", enrollment_id: "enrollment-1", amount_cents: 22000, paid_cents: 10000, status: "overdue", due_at: "2026-10-05" }];
    const rows = buildMonthlyPaymentRows({ ...base, charges, month: "2026-10" });
    expect(rows).toHaveLength(2);
    expect(rows[0].state).toBe("pending"); expect(rows[1].state).toBe("partial");
  });
  it("não usa preço de catálogo para contrato legado sem snapshot", () => {
    expect(buildMonthlyPaymentRows({ ...base, enrollments: [{ ...base.enrollments[0], contract_amount_cents: undefined }], charges: [], month: "2026-10" })[0].amountCents).toBe(null);
  });
});
