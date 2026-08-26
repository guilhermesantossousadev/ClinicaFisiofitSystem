import { describe, expect, it } from "vitest";
import { agendaCapabilities, agendaResourcePaths, professionalUnitIds, professionalsForUnit, resourcesForUnit } from "./agendaResources";

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

  it("não carrega matrículas nem expõe gestão de turmas ao profissional", () => {
    expect(agendaResourcePaths("/appointments?from=a&to=b", "professional")).not.toContain("/enrollments");
    expect(agendaCapabilities("professional", true)).toEqual({
      canManageAppointments: true,
      canManageGroups: false,
      canViewEnrollments: false,
    });
  });

  it("mantém gestão de turmas e matrículas para a recepção", () => {
    expect(agendaResourcePaths("/appointments?from=a&to=b", "reception")).toContain("/enrollments");
    expect(agendaCapabilities("reception", true).canManageGroups).toBe(true);
  });
});
