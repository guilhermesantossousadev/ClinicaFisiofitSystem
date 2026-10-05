import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { OperationalEnrollments } from "./OperationalEnrollments";

const resources = vi.hoisted(() => ({ data: {} as Record<string, any> }));
vi.mock("../../infrastructure/http/api", () => ({ api: vi.fn() }));
vi.mock("./OperationalShared", async (importOriginal) => ({
  ...await importOriginal<typeof import("./OperationalShared")>(),
  useResources: () => ({ data: resources.data, loading: false, error: "", reload: vi.fn() }),
}));

function fixture(unit: string, amount: number) {
  const patient = { id: `patient-${unit}`, name: `Fixture ${unit}`, active: true };
  return {
    "/patients?page=1&pageSize=100": { items: [patient] },
    "/plans": [{ id: "plan", name: "Plano artificial", price_cents: amount }],
    "/enrollments": [{ id: `enrollment-${unit}`, patient_id: patient.id, plan_id: "plan", unit_id: unit, status: "active", starts_at: "2026-01-01" }],
    "/charges": [{ id: `charge-${unit}`, enrollment_id: `enrollment-${unit}`, patient_id: patient.id, amount_cents: amount, paid_cents: 0, status: "pending", due_at: "2026-10-01", coverage_from: "2020-01-01", coverage_to: "2099-12-31" }],
  };
}

describe("HOTFIX-001C — contexto de unidade no recebimento", () => {
  let view: ReactTestRenderer;
  const screen = (unit: string) => <OperationalEnrollments selectedUnitId={unit} canEdit={false} canManagePlans={false} canViewCharges={false} canManageChargeStatus={false} />;
  const field = (name: string) => view.root.findByProps({ name });
  const confirm = () => view.root.findByProps({ className: "btn primary payment-submit" });
  function selectPerson() {
    act(() => view.root.findByProps({ id: "payment-patient", role: "combobox" }).props.onChange({ target: { value: "Fixture" } }));
    act(() => view.root.findAllByProps({ role: "option" })[0].props.onClick());
  }
  beforeEach(() => {
    // O teste usa o seletor real; buscas remotas não são necessárias para fixtures locais.
    vi.stubGlobal("window", { setTimeout: vi.fn(() => 0), clearTimeout: vi.fn() });
    resources.data = fixture("A", 10000);
    act(() => { view = create(screen("A")); });
  });
  afterEach(() => {
    act(() => view.unmount());
    vi.unstubAllGlobals();
  });

  it.each([["A", "B"], ["B", "A"]])("limpa seleção na troca %s → %s e permite selecionar a nova cobrança", (from, to) => {
    resources.data = fixture(from, 10000);
    act(() => view.update(screen(from)));
    selectPerson();
    expect(field("charge_id").props.value).toBe(`charge-${from}`);
    expect(field("amount").props.value).toBe("100.00");
    expect(confirm().props.disabled).toBe(false);

    resources.data = fixture(to, 22000);
    act(() => view.update(screen(to)));
    expect(view.root.findAllByType("input").find((input) => input.props.name === "payment_patient_id")?.props.value).toBe("");
    expect(view.root.findByProps({ id: "payment-patient", role: "combobox" }).props.value).toBe("");
    expect(field("charge_id").props.value).toBe("");
    expect(field("amount").props.value).toBe("");
    expect(field("amount").props.disabled).toBe(true);
    expect(confirm().props.disabled).toBe(true);

    selectPerson();
    expect(field("charge_id").props.value).toBe(`charge-${to}`);
    expect(field("amount").props.value).toBe("220.00");
    expect(confirm().props.disabled).toBe(false);
  });

  it("mantém formulário vazio ao trocar unidade sem seleção", () => {
    expect(confirm().props.disabled).toBe(true);
    resources.data = fixture("B", 22000);
    act(() => view.update(screen("B")));
    expect(field("charge_id").props.value).toBe("");
    expect(field("amount").props.value).toBe("");
    expect(confirm().props.disabled).toBe(true);
  });

  it("limpa apenas a pessoa selecionada mesmo quando nenhum plano foi escolhido", () => {
    const original = resources.data["/charges"][0];
    resources.data = { ...resources.data, "/charges": [original, { ...original, id: "charge-A-2" }] };
    act(() => view.update(screen("A")));
    selectPerson();
    expect(field("charge_id").props.value).toBe("");
    expect(confirm().props.disabled).toBe(true);
    resources.data = fixture("B", 22000);
    act(() => view.update(screen("B")));
    expect(view.root.findByProps({ id: "payment-patient", role: "combobox" }).props.value).toBe("");
    expect(field("amount").props.value).toBe("");
    expect(confirm().props.disabled).toBe(true);
  });

  it("não mantém saldo ao entrar em unidade sem cobrança e reabrir o fluxo", () => {
    selectPerson();
    resources.data = { ...fixture("B", 22000), "/charges": [] };
    act(() => view.update(screen("B")));
    expect(field("charge_id").props.value).toBe("");
    expect(field("amount").props.value).toBe("");
    expect(confirm().props.disabled).toBe(true);
    act(() => view.unmount());
    resources.data = fixture("A", 10000);
    act(() => { view = create(screen("A")); });
    expect(field("amount").props.value).toBe("");
    expect(confirm().props.disabled).toBe(true);
    selectPerson();
    expect(confirm().props.disabled).toBe(false);
  });

  it("preserva a seleção durante uma atualização da mesma unidade", () => {
    selectPerson();
    act(() => view.update(screen("A")));
    expect(field("charge_id").props.value).toBe("charge-A");
    expect(field("amount").props.value).toBe("100.00");
    expect(confirm().props.disabled).toBe(false);
  });

  it("desabilita confirmação e valor quando a cobrança selecionada deixa de estar disponível", () => {
    selectPerson();
    resources.data = { ...resources.data, "/charges": [] };
    act(() => view.update(screen("A")));
    expect(confirm().props.disabled).toBe(true);
    expect(field("amount").props.disabled).toBe(true);
  });
});
