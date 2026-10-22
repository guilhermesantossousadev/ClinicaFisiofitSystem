import type { PermissionModule, Role, View } from "../../domain/portal";

export type NavigationItem = { label: View; icon: string; roles: Role[] };

export const nav: NavigationItem[] = [
  { label: "Pacientes", icon: "♙", roles: ["admin", "manager", "reception", "professional", "finance"] },
  { label: "Matrículas", icon: "◇", roles: ["admin", "manager", "reception", "professional", "finance"] },
  { label: "Agenda", icon: "□", roles: ["admin", "manager", "reception", "professional", "finance"] },
  { label: "Chamada diária", icon: "✓", roles: ["admin", "manager", "reception", "professional", "finance"] },
];

export const roleLabel: Record<Role, string> = {
  admin: "Equipe", manager: "Equipe", reception: "Equipe", professional: "Equipe", finance: "Equipe",
};

export const navModule: Partial<Record<View, PermissionModule>> = {
  Painel: "dashboard", Agenda: "agenda", "Chamada diária": "agenda", Pacientes: "patients", Matrículas: "enrollments", Prontuários: "records", Financeiro: "finance", Relatórios: "reports", Importações: "imports", Usuários: "users", Configurações: "settings", Privacidade: "privacy",
};

export function isView(value: string): value is View {
  return value === "Meu perfil" || nav.some((item) => item.label === value);
}
