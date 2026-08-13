export type View =
  | "Painel"
  | "Agenda"
  | "Pacientes"
  | "Matrículas"
  | "Prontuários"
  | "Financeiro"
  | "Relatórios"
  | "Importações"
  | "Usuários"
  | "Configurações"
  | "Privacidade";

export type Role = "admin" | "manager" | "reception" | "professional" | "finance";
export type PermissionModule = "dashboard" | "agenda" | "patients" | "enrollments" | "records" | "finance" | "reports" | "imports" | "users" | "settings" | "privacy";

export type Unit = { id: string; name: string; active: boolean };
export type Profile = { name: string; role: Role; profile_permissions?: Array<{ module: PermissionModule; can_view: boolean; can_edit: boolean }> };
export type Patient = { id: string; name: string; phone?: string; cpf?: string; primary_unit_id: string };

export type DashboardData = {
  activePatients: number;
  appointmentsToday: number;
  overdueCharges: number;
  overdueAmountCents: number;
  receivedMonthCents: number;
  paidExpensesMonthCents: number;
  appointments: Array<{
    id: string;
    status: string;
    starts_at: string;
    patients?: { name: string } | null;
    professionals?: { name: string } | null;
    services?: { name: string } | null;
    units?: { name: string } | null;
  }>;
};
