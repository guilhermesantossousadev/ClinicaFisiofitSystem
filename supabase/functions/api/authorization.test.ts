import { defaultPermissionsForRole, moduleForPath, type PermissionModule, type Role } from "./authorization.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function modulesFor(role: Role) {
  return new Set(defaultPermissionsForRole(role).map((permission) => permission.module));
}

Deno.test("papéis sensíveis usam uma matriz de acesso fail-closed", () => {
  const professional = modulesFor("professional");
  const reception = modulesFor("reception");
  const finance = modulesFor("finance");
  assert(!professional.has("finance"), "professional não pode receber o módulo financeiro");
  assert(!reception.has("records"), "reception não pode receber o módulo de prontuários");
  assert(!finance.has("records"), "finance não pode receber o módulo de prontuários");
});

Deno.test("todos os cinco papéis possuem configuração explícita e segura", () => {
  const expected: Record<Role, PermissionModule[]> = {
    admin: [],
    manager: ["records", "finance"],
    reception: ["agenda", "patients", "enrollments"],
    professional: ["agenda", "patients", "records"],
    finance: ["enrollments", "finance", "reports"],
  };
  for (const role of Object.keys(expected) as Role[]) {
    const actual = modulesFor(role);
    for (const permission of expected[role]) assert(actual.has(permission), `${role} deveria possuir ${permission}`);
  }
});

Deno.test("recepção pode concluir o fluxo operacional de matrícula", () => {
  const permission = defaultPermissionsForRole("reception").find((item) => item.module === "enrollments");
  assert(permission?.canView, "recepção deve visualizar matrículas");
  assert(permission?.canEdit, "recepção deve criar e atualizar matrículas");
});

Deno.test("rotas clínicas e financeiras são associadas ao módulo correto", () => {
  assert(moduleForPath("/api/v1/clinical-records") === "records", "prontuário deve exigir records");
  assert(moduleForPath("/api/v1/financial-entries") === "finance", "lançamento deve exigir finance");
  assert(moduleForPath("/api/v1/attendance/daily") === "agenda", "chamada diária deve exigir agenda");
  assert(moduleForPath("/api/v1/units", "POST") === "settings", "escrita de unidade deve exigir settings");
  assert(moduleForPath("/api/v1/units", "GET") === null, "referência de unidade deve continuar sob RLS");
});
