export type AgendaResource = Record<string, unknown> & { id?: string };
export type AgendaRole = "admin" | "manager" | "reception" | "professional" | "finance";

export function agendaCapabilities(role: AgendaRole, canEdit: boolean) {
  return {
    canManageAppointments: canEdit,
    canManageGroups: canEdit && role !== "professional",
    canViewEnrollments: ["admin", "manager", "reception"].includes(role),
  };
}

export function agendaResourcePaths(appointmentsPath: string, role: AgendaRole) {
  return [
    appointmentsPath,
    "/units",
    "/professionals",
    "/services",
    "/rooms",
    "/patients?page=1&pageSize=100",
    "/group-slots",
    "/group-slot-memberships",
    ...(["admin", "manager", "reception"].includes(role) ? ["/enrollments"] : []),
  ];
}

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
