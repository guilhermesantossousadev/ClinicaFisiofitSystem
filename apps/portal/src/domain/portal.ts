export type View =
  | "Painel"
  | "Agenda"
  | "Chamada diária"
  | "Pacientes"
  | "Matrículas"
  | "Prontuários"
  | "Financeiro"
  | "Relatórios"
  | "Importações"
  | "Usuários"
  | "Configurações"
  | "Privacidade"
  | "Meu perfil";

export type Role = "admin" | "manager" | "reception" | "professional" | "finance";
export type PermissionModule = "dashboard" | "agenda" | "patients" | "enrollments" | "records" | "finance" | "reports" | "imports" | "users" | "settings" | "privacy";

export type Unit = { id: string; name: string; active: boolean };
export type Profile = { name: string; role: Role; avatar_url?: string; profile_permissions?: Array<{ module: PermissionModule; can_view: boolean; can_edit: boolean }> };
export type Patient = { id: string; name: string; phone?: string; cpf?: string; primary_unit_id: string };

export type DashboardData = {
  activePatients: number;
  appointmentsToday: number;
  overdueCharges: number;
  overdueAmountCents: number;
  dueCharges: Array<{
    id: string;
    description: string;
    amount_cents: number;
    paid_cents: number;
    due_at: string;
    patients?: { name: string } | null;
    units?: { name: string } | null;
  }>;
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
