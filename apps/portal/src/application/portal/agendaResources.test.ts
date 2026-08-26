import { describe, expect, it } from "vitest";
import { professionalUnitIds, professionalsForUnit, resourcesForUnit } from "./agendaResources";

describe("recursos da agenda por unidade", () => {
  const professionals = [
    { id: "ana", name: "Ana", active: true, unit_ids: ["centro"] },
    { id: "bia", name: "Bia", active: true, professional_units: [{ unit_id: "lagoa" }] },
    { id: "clara", name: "Clara", active: false, unit_ids: ["centro"] },
  ];

  it("normaliza os vínculos de unidade retornados pela API", () => {
    expect(professionalUnitIds(professionals[1])).toEqual(["lagoa"]);
  });

  it("mostra somente fisioterapeutas ativos da unidade escolhida", () => {
    expect(professionalsForUnit(professionals, "centro").map((row) => row.id)).toEqual(["ana"]);
    expect(professionalsForUnit(professionals, "lagoa").map((row) => row.id)).toEqual(["bia"]);
  });

  it("preserva o responsável atual durante uma correção", () => {
    expect(professionalsForUnit(professionals, "centro", "clara").map((row) => row.id)).toEqual(["ana", "clara"]);
  });

  it("filtra salas e pacientes pela unidade", () => {
    expect(resourcesForUnit([{ id: "1", unit_id: "centro" }, { id: "2", unit_id: "lagoa" }], "centro").map((row) => row.id)).toEqual(["1"]);
    expect(resourcesForUnit([{ id: "1", primary_unit_id: "centro" }, { id: "2", primary_unit_id: "lagoa" }], "lagoa", "primary_unit_id").map((row) => row.id)).toEqual(["2"]);
  });
});
