export type Role = "admin" | "manager" | "reception" | "professional" | "finance";
export type PermissionModule = "dashboard" | "agenda" | "patients" | "enrollments" | "records" | "finance" | "reports" | "imports" | "users" | "settings" | "privacy";

export function defaultPermissionsForRole(role: Role): Array<{ module: PermissionModule; canView: boolean; canEdit: boolean }> {
  const access: Partial<Record<Role, Partial<Record<PermissionModule, "view" | "edit">>>> = {
    manager: {
      dashboard: "edit", agenda: "edit", patients: "edit", enrollments: "edit", records: "edit",
      finance: "edit", reports: "view", imports: "edit", users: "view", settings: "edit", privacy: "edit",
    },
    reception: { agenda: "edit", patients: "edit", enrollments: "edit" },
    professional: { agenda: "edit", patients: "view", records: "edit" },
    finance: { enrollments: "view", finance: "edit", reports: "view" },
  };
  return Object.entries(access[role] ?? {}).map(([module, permission]) => ({
    module: module as PermissionModule,
    canView: true,
    canEdit: permission === "edit",
  }));
}

export function moduleForPath(path: string, method = "GET"): PermissionModule | null {
  const normalizedPath = path.replace(/^\/api\/v1(?=\/|$)/, "");
  const match = normalizedPath.match(/^\/([^/]+)/)?.[1];
  if (method === "GET" && match && ["units", "rooms", "professionals", "services"].includes(match)) return null;
  const map: Record<string, PermissionModule> = {
    dashboard: "dashboard", appointments: "agenda", attendance: "agenda", "group-slots": "agenda", patients: "patients", responsibles: "patients", consents: "patients",
    enrollments: "enrollments", charges: "enrollments", "record-templates": "records", "clinical-records": "records", attachments: "records",
    plans: "enrollments", "group-slot-memberships": "agenda", payments: "finance", "financial-entries": "finance", commissions: "finance",
    closings: "finance", reports: "reports", imports: "imports", users: "users", units: "settings", rooms: "settings",
    professionals: "settings", services: "settings", privacy: "privacy", audit: "privacy",
  };
  return match ? map[match] ?? null : null;
}
