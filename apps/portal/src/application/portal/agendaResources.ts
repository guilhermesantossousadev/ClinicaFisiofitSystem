export type AgendaResource = Record<string, unknown> & { id?: string };

export function professionalUnitIds(professional: AgendaResource) {
  if (Array.isArray(professional.unit_ids)) return professional.unit_ids.map(String);
  if (!Array.isArray(professional.professional_units)) return [];
  return professional.professional_units
    .map((link) => String((link as { unit_id?: unknown }).unit_id ?? ""))
    .filter(Boolean);
}

export function professionalsForUnit<T extends AgendaResource>(rows: T[], unitId: string, currentId = "") {
  return rows.filter((row) => {
    if (String(row.id ?? "") === currentId) return true;
    return row.active !== false && Boolean(unitId) && professionalUnitIds(row).includes(unitId);
  });
}

export function resourcesForUnit<T extends AgendaResource>(rows: T[], unitId: string, unitField = "unit_id") {
  return rows.filter((row) => Boolean(unitId) && String(row[unitField] ?? "") === unitId && row.active !== false);
}
