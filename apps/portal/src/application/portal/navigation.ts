import type { PermissionModule, Role, View } from "../../domain/portal";

export type NavigationItem = { label: View; icon: string; roles: Role[] };

export const nav: NavigationItem[] = [
  { label: "Painel", icon: "⌂", roles: ["admin", "manager", "reception", "professional", "finance"] },
  { label: "Agenda", icon: "□", roles: ["admin", "manager", "reception", "professional"] },
  { label: "Chamada diária", icon: "✓", roles: ["admin", "manager", "reception", "professional"] },
  { label: "Pacientes", icon: "♙", roles: ["admin", "manager", "reception"] },
  { label: "Matrículas", icon: "◇", roles: ["admin", "manager", "reception", "finance"] },
  { label: "Prontuários", icon: "▤", roles: ["admin", "manager", "professional"] },
  { label: "Financeiro", icon: "R$", roles: ["admin", "manager", "finance"] },
  { label: "Relatórios", icon: "↗", roles: ["admin", "manager", "finance"] },
  { label: "Importações", icon: "⇧", roles: ["admin", "manager"] },
  { label: "Usuários", icon: "⚙", roles: ["admin", "manager"] },
  { label: "Configurações", icon: "⌖", roles: ["admin", "manager"] },
  { label: "Privacidade", icon: "✓", roles: ["admin", "manager"] },
];

export const roleLabel: Record<Role, string> = {
  admin: "Administrador", manager: "Gestor", reception: "Recepção", professional: "Profissional", finance: "Financeiro",
};

export const navModule: Partial<Record<View, PermissionModule>> = {
  Painel: "dashboard", Agenda: "agenda", "Chamada diária": "agenda", Pacientes: "patients", Matrículas: "enrollments", Prontuários: "records", Financeiro: "finance", Relatórios: "reports", Importações: "imports", Usuários: "users", Configurações: "settings", Privacidade: "privacy",
};

export function isView(value: string): value is View {
  return value === "Meu perfil" || nav.some((item) => item.label === value);
}
