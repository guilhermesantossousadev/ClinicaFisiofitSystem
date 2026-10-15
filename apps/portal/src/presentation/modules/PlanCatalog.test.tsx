import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanCatalog } from "./PlanCatalog";
import { PlanSelect } from "./OperationalShared";

const plans = [30,90,180].flatMap((duration) => [1,2,3].map((frequency) => ({ id: `${duration}-${frequency}`, name: `${duration} dias · ${frequency}x`, duration_days: duration, sessions_included: duration/30*frequency*4, price_cents: duration*100+frequency, active: true })));
describe("catálogo de nove planos", () => {
  it("apresenta as nove combinações, preços fornecidos e aulas", () => {
    const html = renderToStaticMarkup(createElement(PlanCatalog, { plans, reload: async () => undefined, onNotice: () => undefined }));
    expect(html).toContain("Gestão de Planos");
    expect(html).toContain("Mensal"); expect(html).toContain("Trimestral"); expect(html).toContain("Semestral");
    expect(html.match(/Editar plano/g)).toHaveLength(9);
    expect(html).toContain("72 aulas"); expect(html).not.toContain("Não cadastrado");
  });
  it("não inventa preços nem cria linhas quando o catálogo está vazio", () => {
    const html = renderToStaticMarkup(createElement(PlanCatalog, { plans: [], reload: async () => undefined, onNotice: () => undefined }));
    expect(html.match(/Não cadastrado/g)).toHaveLength(9);
    expect(html).not.toContain("R$");
  });
  it("permite selecionar as nove combinações ativas, escondendo inativas", () => {
    const html = renderToStaticMarkup(createElement(PlanSelect, { rows: [...plans, { ...plans[0], id: "inactive", name: "Inativo oculto", active: false }] }));
    for (const plan of plans) expect(html).toContain(`value="${plan.id}"`);
    expect(html).not.toContain("Inativo oculto");
  });
});
