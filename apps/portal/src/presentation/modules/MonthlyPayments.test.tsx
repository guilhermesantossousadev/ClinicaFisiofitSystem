import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlyPayments } from "./MonthlyPayments";

function renderStatus(status: "pending" | "overdue" | "partial" | "paid", paidCents = 0) {
  const data = {
    "/enrollments": [{ id: "enrollment-1", patient_id: "patient-1", plan_id: "plan-1", unit_id: "unit-1", starts_at: "2026-01-01", due_day: 5, status: "active" }],
    "/patients?page=1&pageSize=100": { items: [{ id: "patient-1", name: "Paciente sintético" }] },
    "/plans": [{ id: "plan-1", name: "Mensal sintético", kind: "monthly", price_cents: 4600, duration_days: 30 }],
    "/charges": [{ id: `charge-${status}`, enrollment_id: "enrollment-1", amount_cents: 4600, paid_cents: paidCents, status, due_at: "2026-10-05", coverage_from: "2026-10-01", coverage_to: "2026-10-31" }],
  };
  return renderToStaticMarkup(createElement(MonthlyPayments, {
    data: data as never,
    month: "2026-10",
    onMonth: () => undefined,
    canEdit: false,
    canCorrectChargeAmounts: true,
    reload: async () => undefined,
    onNotice: () => undefined,
  }));
}

describe("ações financeiras da recepção no Controle de Planos", () => {
  it.each(["pending", "overdue"] as const)("mostra somente correção e contrato para cobrança %s", (status) => {
    const html = renderStatus(status);
    expect(html).toContain("Editar valor da cobrança");
    expect(html).toContain("Definir valor mensal");
    expect(html).not.toContain("Registrar recebimento");
    expect(html).not.toContain("Criar cobrança");
  });

  it.each([["partial", 1000], ["paid", 4600]] as const)("não oferece edição da cobrança %s", (status, paidCents) => {
    const html = renderStatus(status, paidCents);
    expect(html).not.toContain("Editar valor da cobrança");
    expect(html).not.toContain("Registrar recebimento");
  });
});
