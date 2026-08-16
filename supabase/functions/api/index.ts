import { Hono } from "npm:hono@4.7.2";
import { cors } from "npm:hono@4.7.2/cors";
import { createClient, type User } from "npm:@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3.24.2";
import { defaultPermissionsForRole, moduleForPath, type PermissionModule, type Role } from "./authorization.ts";
import { registerUsuariosRoutes } from "./routes/usuarios.ts";
import { registerPrivacidadeRoutes } from "./routes/privacidade.ts";
import { registerPacientesRoutes } from "./routes/pacientes.ts";
import { registerAgendaRoutes } from "./routes/agenda.ts";
import { registerProntuariosRoutes } from "./routes/prontuarios.ts";
import { registerFinanceiroRoutes } from "./routes/financeiro.ts";
import { registerImportacoesRoutes } from "./routes/importacoes.ts";

type DatabaseClient = ReturnType<typeof createClient<any>>;
type Variables = {
  requestId: string;
  user: User;
  profile: {
    id: string;
    clinic_id: string;
    name: string;
    role: Role;
    status: string;
  };
  db: DatabaseClient;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api/v1");
const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "https://clinicafisiofitsabara.com";

app.use("*", cors({
  origin: (origin) =>
    origin === allowedOrigin || origin.startsWith("http://localhost:")
      ? origin
      : allowedOrigin,
  // O cliente do portal envia a chave publicável no cabeçalho `apikey`.
  // Sem autorizá-lo no preflight, o navegador bloqueia a resposta antes que
  // ela chegue à aplicação e um login válido parece uma falha de conexão.
  allowHeaders: ["authorization", "apikey", "content-type", "idempotency-key", "x-request-id"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  maxAge: 86400,
}));

app.use("*", async (context, next) => {
  context.set("requestId", context.req.header("x-request-id") ?? crypto.randomUUID());
  await next();
  context.header("x-request-id", context.get("requestId"));
  context.header("cache-control", "no-store");
  context.header("x-content-type-options", "nosniff");
});

app.get("/health", (context) => ok(context, {
  status: "healthy",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
}));

app.get("/openapi.json", (context) => ok(context, openApiDocument));

app.post("/bootstrap", async (context) => {
  const auth = context.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return fail(context, 401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");
  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return fail(context, 401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");
  const input = z.object({
    clinicName: z.string().trim().min(3).max(120),
    adminName: z.string().trim().min(3).max(120),
  }).parse(await context.req.json());
  const { data, error } = await client.rpc("bootstrap_clinic", {
    p_name: input.clinicName,
    p_admin_name: input.adminName,
  });
  return databaseResult(context, { clinicId: data }, error, 201);
});

app.use("*", async (context, next) => {
  const auth = context.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return fail(context, 401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");

  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const db = createClient<any>(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError || !authData.user) return fail(context, 401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, clinic_id, name, role, status, profile_permissions(module,can_view,can_edit)")
    .eq("id", authData.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    return fail(context, 500, "PROFILE_LOOKUP_FAILED", "Não foi possível validar seu acesso agora.");
  }

  if (!profile) {
    const { data: bootstrapAvailable, error: bootstrapError } = await db.rpc("bootstrap_available");
    if (bootstrapError) {
      return fail(context, 500, "PROFILE_LOOKUP_FAILED", "Não foi possível validar seu acesso agora.");
    }
    return bootstrapAvailable
      ? fail(context, 403, "BOOTSTRAP_REQUIRED", "A configuração inicial da clínica ainda não foi concluída.")
      : fail(context, 403, "MEMBERSHIP_NOT_FOUND", "Esta conta não possui acesso à clínica.");
  }

  if (profile.status !== "active") {
    const code = profile.status === "blocked" ? "MEMBERSHIP_BLOCKED" : "MEMBERSHIP_INVITED";
    const message = profile.status === "blocked"
      ? "Esta conta está bloqueada."
      : "Esta conta ainda precisa ser ativada.";
    return fail(context, 403, code, message);
  }

  context.set("user", authData.user);
  context.set("profile", profile as Variables["profile"]);
  context.set("db", db);
  await next();
});

const patientSchema = z.object({
  primary_unit_id: z.string().uuid(),
  name: z.string().trim().min(3).max(160),
  cpf: z.string().trim().min(11).max(14).optional(),
  birth_date: z.string().date().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.record(z.string()).optional(),
  tax_data: z.record(z.unknown()).optional(),
  notes: z.string().max(4000).optional(),
});

const appointmentFields = z.object({
  unit_id: z.string().uuid(),
  patient_id: z.string().uuid().optional(),
  professional_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  enrollment_id: z.string().uuid().optional(),
  group_slot_id: z.string().uuid().optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  notes: z.string().max(1000).optional(),
});

const appointmentSchema = appointmentFields.refine((value) => value.ends_at > value.starts_at, {
  path: ["ends_at"],
  message: "O término deve ocorrer depois do início.",
});

const financialEntrySchema = z.object({
  unit_id: z.string().uuid(),
  kind: z.enum(["income", "expense"]),
  description: z.string().min(3).max(240),
  category: z.string().min(2).max(100),
  cost_center: z.string().max(100).optional(),
  amount_cents: z.number().int().positive(),
  competence_date: z.string().date(),
  settled_at: z.string().datetime({ offset: true }).optional(),
});

const clinicalRecordSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  professional_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  kind: z.enum(["assessment", "evolution"]),
  template_id: z.string().uuid().optional(),
  template_version: z.number().int().positive().optional(),
  payload: z.record(z.unknown()),
});

app.get("/me", (context) => ok(context, {
  user: { id: context.get("user").id, email: context.get("user").email },
  profile: context.get("profile"),
}));

app.get("/dashboard", requireRoles(["admin", "manager"]), async (context) => {
  const clinicId = context.get("profile").clinic_id;
  const date = z.string().date().default(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  ).parse(context.req.query("date"));
  const startsAt = `${date}T00:00:00-03:00`;
  const endsAt = `${date}T23:59:59.999-03:00`;
  const monthStart = `${date.slice(0, 7)}-01`;
  const unitId = context.req.query("unitId");
  const db = context.get("db");
  if (unitId && !(await hasUnitAccess(context, z.string().uuid().parse(unitId)))) {
    return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
  }

  const nextWeek = new Date(`${date}T00:00:00-03:00`);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(nextWeek);
  const [patients, appointments, overdueCharges, dueCharges, monthEntries, units] = await Promise.all([
    (() => { let query = db.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).is("deleted_at", null); if (unitId) query = query.eq("primary_unit_id", unitId); return query; })(),
    (() => { let query = db.from("appointments").select("id,status,starts_at,ends_at,patients(id,name),professionals(id,name),services(id,name),units(id,name)").eq("clinic_id", clinicId).gte("starts_at", startsAt).lte("starts_at", endsAt).is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query.order("starts_at"); })(),
    (() => { let query = db.from("charges").select("id,amount_cents,paid_cents", { count: "exact" }).eq("clinic_id", clinicId).eq("status", "overdue").is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query; })(),
    (() => { let query = db.from("charges").select("id,description,amount_cents,paid_cents,due_at,status,patients(name),units(name)").eq("clinic_id", clinicId).eq("status", "pending").gte("due_at", date).lte("due_at", nextWeekDate).is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query.order("due_at").limit(8); })(),
    (() => { let query = db.from("financial_entries").select("kind,amount_cents,settled_at").eq("clinic_id", clinicId).gte("competence_date", monthStart).lte("competence_date", date).is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query; })(),
    db.from("units").select("id,name,active").eq("clinic_id", clinicId)
      .is("deleted_at", null).order("name"),
  ]);

  const error =
    patients.error ??
    appointments.error ??
    overdueCharges.error ??
    dueCharges.error ??
    monthEntries.error ??
    units.error;

  const entries = monthEntries.data ?? [];
  const overdue = overdueCharges.data ?? [];
  return databaseResult(context, {
    date,
    activePatients: patients.count ?? 0,
    appointmentsToday: appointments.data?.length ?? 0,
    appointments: appointments.data ?? [],
    overdueCharges: overdueCharges.count ?? 0,
    overdueAmountCents: overdue.reduce(
      (sum, charge) => sum + Math.max(Number(charge.amount_cents) - Number(charge.paid_cents), 0),
      0,
    ),
    dueCharges: dueCharges.data ?? [],
    receivedMonthCents: entries
      .filter((entry) => entry.kind === "income" && entry.settled_at)
      .reduce((sum, entry) => sum + Number(entry.amount_cents), 0),
    paidExpensesMonthCents: entries
      .filter((entry) => entry.kind === "expense" && entry.settled_at)
      .reduce((sum, entry) => sum + Number(entry.amount_cents), 0),
    units: units.data ?? [],
  }, error);
});

registerUsuariosRoutes(app, { allowedOrigin, requireRoles, ok, fail, databaseResult, audit, requiredEnv });

app.get("/units", requireRoles(["admin", "manager", "reception", "professional", "finance"]), async (context) => {
  const { data, error } = await context.get("db").from("units").select("*").is("deleted_at", null).order("name");
  return databaseResult(context, data, error);
});

app.post("/units", requireRoles(["admin"]), async (context) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    address: z.record(z.string()).default({}),
    phone: z.string().max(20).optional(),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("units").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, "unit.created", "unit", data.id);
  return databaseResult(context, data, error, 201);
});

app.patch("/units/:id", requireRoles(["admin"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    address: z.record(z.string()).optional(),
    phone: z.string().max(20).nullable().optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "units", id, input, "unit.updated");
});

app.get("/rooms", requireRoles(["admin", "manager", "reception", "professional"]), listResource("rooms", "name"));
app.get("/professionals", requireRoles(["admin", "manager", "reception", "professional", "finance"]), listResource("professionals", "name"));
app.get("/services", requireRoles(["admin", "manager", "reception", "professional"]), listResource("services", "name"));
app.get("/plans", requireRoles(["admin", "manager", "reception", "finance"]), listResource("plans", "name"));
app.get("/group-slots", requireRoles(["admin", "manager", "reception", "professional"]), listResource("group_slots", "starts_at"));
app.get("/group-slot-memberships", requireRoles(["admin", "manager", "reception", "professional"]), async (context) => {
  const clinicId = context.get("profile").clinic_id;
  let query = context.get("db").from("group_slot_memberships")
    .select("id,group_slot_id,enrollment_id,patient_id,starts_at,ends_at,status,patients(name,phone)")
    .eq("clinic_id", clinicId).is("deleted_at", null).eq("status", "active");
  const groupSlotId = context.req.query("groupSlotId");
  if (groupSlotId) query = query.eq("group_slot_id", z.string().uuid().parse(groupSlotId));
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1000);
  return databaseResult(context, data, error);
});
app.get("/enrollments", requireRoles(["admin", "manager", "reception", "finance"]), listResource("enrollments", "created_at", false));
app.get("/charges", requireRoles(["admin", "manager", "finance"]), listResource("charges", "due_at", false));
app.get("/payments", requireRoles(["admin", "manager", "finance"]), listResource("payments", "paid_at", false));
app.get("/commissions", requireRoles(["admin", "manager", "finance"]), listResource("commissions", "created_at", false));
app.get("/fiscal-documents", requireRoles(["admin", "manager", "finance"]), listResource("fiscal_documents", "created_at", false));
app.get("/notifications", requireRoles(["admin", "manager", "reception"]), listResource("notifications", "scheduled_at", false));
app.get("/audit", requireRoles(["admin", "manager"]), listResource("audit_events", "occurred_at", false));
app.get("/privacy/requests", requireRoles(["admin", "manager"]), listResource("data_subject_requests", "created_at", false));
app.get("/privacy/incidents", requireRoles(["admin"]), listResource("privacy_incidents", "created_at", false));

registerPrivacidadeRoutes(app, { requireRoles, databaseResult, audit, createClinicResource });

app.post("/rooms", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    unit_id: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    capacity: z.number().int().min(1).max(20).default(7),
  }).parse(await context.req.json());
  return createClinicResource(context, "rooms", input, "room.created", input.unit_id);
});

app.patch("/rooms/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    unit_id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    capacity: z.number().int().min(1).max(20).optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "rooms", id, input, "room.updated", input.unit_id);
});

app.post("/professionals", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    name: z.string().trim().min(3).max(120),
    profile_id: z.string().uuid().optional(),
    council: z.string().max(40).optional(),
    specialty: z.string().max(100).optional(),
    active: z.boolean().default(true),
    unitIds: z.array(z.string().uuid()).min(1),
  }).parse(await context.req.json());
  const { unitIds, ...professional } = input;
  const db = context.get("db");
  const { data, error } = await db.from("professionals").insert({
    ...professional,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (error || !data) return databaseResult(context, null, error);
  const { error: unitsError } = await db.from("professional_units").insert(
    unitIds.map((unitId) => ({ professional_id: data.id, unit_id: unitId })),
  );
  if (unitsError) return databaseResult(context, null, unitsError);
  await audit(context, "professional.created", "professional", data.id);
  return ok(context, data, 201);
});

app.patch("/professionals/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(3).max(160).optional(),
    council: z.string().max(80).nullable().optional(),
    specialty: z.string().max(100).nullable().optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "professionals", id, input, "professional.updated");
});

app.post("/services", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    duration_minutes: z.number().int().min(5).max(480),
    price_cents: z.number().int().nonnegative(),
    color: z.string().max(20).optional(),
    active: z.boolean().default(true),
  }).parse(await context.req.json());
  return createClinicResource(context, "services", input, "service.created");
});

app.patch("/services/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    duration_minutes: z.number().int().min(5).max(480).optional(),
    price_cents: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "services", id, input, "service.updated");
});

app.post("/plans", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    kind: z.enum(["monthly", "package", "single"]),
    sessions_included: z.number().int().positive().optional(),
    duration_days: z.number().int().positive().optional(),
    price_cents: z.number().int().nonnegative(),
    active: z.boolean().default(true),
  }).parse(await context.req.json());
  return createClinicResource(context, "plans", input, "plan.created");
});

app.patch("/plans/:id", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    sessions_included: z.number().int().positive().nullable().optional(),
    duration_days: z.number().int().positive().nullable().optional(),
    price_cents: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "plans", id, input, "plan.updated");
});

app.post("/enrollments", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = z.object({
    patient_id: z.string().uuid(),
    plan_id: z.string().uuid(),
    unit_id: z.string().uuid(),
    starts_at: z.string().date(),
    ends_at: z.string().date().optional(),
    due_day: z.number().int().min(1).max(31).optional(),
    discount_cents: z.number().int().nonnegative().default(0),
    surcharge_cents: z.number().int().nonnegative().default(0),
  }).parse(await context.req.json());
  const db = context.get("db");
  const scopeError = await validateRelatedResourceScope(context, input);
  if (scopeError) return scopeError;
  const clinicId = context.get("profile").clinic_id;
  const { data: plan, error: planError } = await db.from("plans").select("id,name,price_cents,active")
    .eq("id", input.plan_id).eq("clinic_id", clinicId).is("deleted_at", null).single();
  if (planError || !plan) return databaseResult(context, null, planError);
  if (!plan.active) return fail(context, 400, "PLAN_INACTIVE", "O plano selecionado está inativo.");
  if (input.ends_at && input.ends_at < input.starts_at) return fail(context, 400, "INVALID_PERIOD", "A data final não pode ser anterior à inicial.");
  const { data: existing } = await db.from("enrollments").select("*").eq("clinic_id", clinicId).eq("patient_id", input.patient_id).eq("plan_id", input.plan_id).eq("unit_id", input.unit_id).eq("status", "active").is("deleted_at", null).maybeSingle();
  if (existing) return ok(context, existing);
  const { data, error } = await db.from("enrollments").insert({
    ...input,
    clinic_id: clinicId,
    status: "active",
  }).select().single();
  if (error || !data) return databaseResult(context, null, error);
  const chargeAmount = Math.max(plan.price_cents - input.discount_cents + input.surcharge_cents, 1);
  const { error: chargeError } = await db.from("charges").insert({
    clinic_id: context.get("profile").clinic_id,
    patient_id: input.patient_id,
    enrollment_id: data.id,
    unit_id: input.unit_id,
    description: `Matrícula — ${plan.name}`,
    amount_cents: chargeAmount,
    due_at: firstDueDate(input.starts_at, input.due_day),
    status: "pending",
  });
  if (chargeError) {
    await db.from("enrollments").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", data.id).eq("clinic_id", clinicId);
    return databaseResult(context, null, chargeError);
  }
  await audit(context, "enrollment.created", "enrollment", data.id, input.unit_id);
  return ok(context, data, 201);
});

app.post("/enrollments/:id/rollback", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(await context.req.json());
  const { data, error } = await context.get("db").rpc("rollback_enrollment", { p_enrollment_id: id, p_reason: input.reason, p_request_id: context.get("requestId") });
  return databaseResult(context, data, error);
});

app.post("/charges", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = z.object({
    patient_id: z.string().uuid(),
    enrollment_id: z.string().uuid().optional(),
    unit_id: z.string().uuid(),
    description: z.string().trim().min(3).max(200),
    amount_cents: z.number().int().positive(),
    due_at: z.string().date(),
    installment_number: z.number().int().positive().optional(),
    installment_count: z.number().int().positive().optional(),
  }).parse(await context.req.json());
  const scopeError = await validateRelatedResourceScope(context, input);
  if (scopeError) return scopeError;
  if (input.enrollment_id) {
    const { data: enrollment } = await context.get("db").from("enrollments").select("id,patient_id,unit_id").eq("id", input.enrollment_id).eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", input.patient_id).eq("unit_id", input.unit_id).eq("status", "active").is("deleted_at", null).maybeSingle();
    if (!enrollment) return fail(context, 400, "INVALID_ENROLLMENT", "A matrícula não pertence ao paciente e à unidade informados.");
  }
  return createClinicResource(context, "charges", { ...input, status: "pending" }, "charge.created", input.unit_id);
});

app.get("/record-templates", requireRoles(["admin", "manager", "professional"]), listResource("record_templates", "name"));

app.post("/record-templates", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    name: z.string().trim().min(3).max(120),
    kind: z.enum(["assessment", "evolution"]),
    specialty: z.string().max(100).optional(),
    schema: z.record(z.unknown()),
    active: z.boolean().default(true),
  }).parse(await context.req.json());
  return createClinicResource(context, "record_templates", input, "record_template.created");
});

app.patch("/record-templates/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(3).max(120).optional(),
    specialty: z.string().max(100).nullable().optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("record_templates").update({
    ...input,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).select().single();
  if (!error && data) await audit(context, "record_template.updated", "record_template", id, null, { changedFields: Object.keys(input) });
  return databaseResult(context, data, error);
});

registerPacientesRoutes(app, { patientSchema, requireRoles, fail, databaseResult, hasUnitAccess, positiveInt, escapeLike, audit, createClinicResource });

registerAgendaRoutes(app, { appointmentFields, appointmentSchema, requireRoles, ok, fail, databaseResult, hasUnitAccess, audit, professionalForUser, isOwnProfessional, getAuthorizedAppointment });

registerProntuariosRoutes(app, { clinicalRecordSchema, requireRoles, fail, databaseResult, hasUnitAccess, audit, professionalForUser, isOwnProfessional, requireIdempotency });

registerFinanceiroRoutes(app, { financialEntrySchema, requireRoles, fail, databaseResult, hasUnitAccess, audit, createClinicResource, requireIdempotency, normalizeAnnual, listResource });

registerImportacoesRoutes(app, { requireRoles, databaseResult, listResource, requireIdempotency, transactionalImportResult, requiredEnv, validateNotionInventory, prepareNotionImport, audit, fail, ok });

app.onError((error, context) => {
  if (error instanceof z.ZodError) {
    return fail(context, 422, "VALIDATION_ERROR", "Revise os dados informados.", error.flatten());
  }
  console.error(JSON.stringify({
    requestId: context.get("requestId"),
    error: error instanceof Error ? error.message : "UNKNOWN",
  }));
  return fail(context, 500, "INTERNAL_ERROR", "Não foi possível concluir a operação.");
});

function listResource(table: string, order: string, ascending = true) {
  return async (context: Parameters<typeof ok>[0]) => {
    const clinicId = context.get("profile").clinic_id;
    let query = context.get("db").from(table).select("*").eq("clinic_id", clinicId);
    const unitId = context.req.query("unitId");
    if (unitId && ["rooms", "group_slots", "enrollments", "charges", "commissions", "financial_entries", "clinical_records"].includes(table)) {
      const parsedUnitId = z.string().uuid().parse(unitId);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("unit_id", parsedUnitId);
    }
    if (![
      "audit_events",
      "notifications",
      "fiscal_documents",
      "payments",
      "commissions",
      "record_templates",
      "monthly_closings",
      "import_batches",
    ].includes(table)) {
      query = query.is("deleted_at", null);
    }
    const { data, error } = await query.order(order, { ascending }).limit(500);
    return databaseResult(context, data, error);
  };
}

async function createClinicResource(
  context: Parameters<typeof ok>[0],
  table: string,
  input: Record<string, unknown>,
  action: string,
  unitId?: string,
) {
  if (unitId && !(await hasUnitAccess(context, unitId))) {
    return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
  }
  const { data, error } = await context.get("db").from(table).insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, action, table.replace(/s$/, ""), data.id, unitId);
  return databaseResult(context, data, error, 201);
}

async function hasUnitAccess(context: Parameters<typeof ok>[0], unitId: string) {
  const { data, error } = await context.get("db").rpc("has_unit_access", { target_unit: unitId });
  return !error && data === true;
}

type RelatedResourceIds = {
  unit_id: string;
  professional_id?: string;
  patient_id?: string;
  room_id?: string;
  service_id?: string;
  appointment_id?: string;
  enrollment_id?: string;
  group_slot_id?: string;
};

async function validateRelatedResourceScope(
  context: Parameters<typeof ok>[0],
  ids: RelatedResourceIds,
) {
  const db = context.get("db");
  const clinicId = context.get("profile").clinic_id;

  if (!(await hasUnitAccess(context, ids.unit_id))) {
    return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
  }

  const [unit, patient, professional, professionalUnit, room, service, appointment, enrollment, groupSlot] = await Promise.all([
    db.from("units").select("id").eq("id", ids.unit_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle(),
    ids.patient_id
      ? db.from("patients").select("id,primary_unit_id").eq("id", ids.patient_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.professional_id
      ? db.from("professionals").select("id").eq("id", ids.professional_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.professional_id
      ? db.from("professional_units").select("professional_id").eq("professional_id", ids.professional_id).eq("unit_id", ids.unit_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.room_id
      ? db.from("rooms").select("id").eq("id", ids.room_id).eq("clinic_id", clinicId).eq("unit_id", ids.unit_id).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.service_id
      ? db.from("services").select("id").eq("id", ids.service_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.appointment_id
      ? db.from("appointments").select("id,unit_id,patient_id,professional_id").eq("id", ids.appointment_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.enrollment_id
      ? db.from("enrollments").select("id,unit_id,patient_id").eq("id", ids.enrollment_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.group_slot_id
      ? db.from("group_slots").select("id,unit_id,room_id,professional_id,service_id").eq("id", ids.group_slot_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const lookupFailed = [unit, patient, professional, professionalUnit, room, service, appointment, enrollment, groupSlot]
    .some((result) => result.error);
  if (lookupFailed) {
    return fail(context, 400, "RELATED_RESOURCE_VALIDATION_FAILED", "Não foi possível validar os dados relacionados.");
  }
  if (!unit.data) return fail(context, 400, "INVALID_UNIT", "A unidade selecionada não pertence à clínica.");
  if (ids.patient_id && (!patient.data || patient.data.primary_unit_id !== ids.unit_id)) {
    return fail(context, 400, "INVALID_PATIENT_SCOPE", "O paciente não pertence à clínica e unidade selecionadas.");
  }
  if (ids.professional_id && (!professional.data || !professionalUnit.data)) {
    return fail(context, 400, "INVALID_PROFESSIONAL_SCOPE", "O profissional não pertence à clínica e unidade selecionadas.");
  }
  if (ids.room_id && !room.data) {
    return fail(context, 400, "INVALID_ROOM_SCOPE", "A sala não pertence à clínica e unidade selecionadas.");
  }
  if (ids.service_id && !service.data) {
    return fail(context, 400, "INVALID_SERVICE_SCOPE", "O serviço não pertence à clínica selecionada.");
  }
  if (ids.appointment_id && (!appointment.data
    || appointment.data.unit_id !== ids.unit_id
    || (ids.patient_id && appointment.data.patient_id !== ids.patient_id)
    || (ids.professional_id && appointment.data.professional_id !== ids.professional_id))) {
    return fail(context, 400, "INVALID_APPOINTMENT_SCOPE", "O atendimento não corresponde à clínica, unidade, paciente e profissional informados.");
  }
  if (ids.enrollment_id && (!enrollment.data
    || enrollment.data.unit_id !== ids.unit_id
    || (ids.patient_id && enrollment.data.patient_id !== ids.patient_id))) {
    return fail(context, 400, "INVALID_ENROLLMENT_SCOPE", "A matrícula não corresponde à clínica, unidade e paciente informados.");
  }
  if (ids.group_slot_id && (!groupSlot.data
    || groupSlot.data.unit_id !== ids.unit_id
    || (ids.room_id && groupSlot.data.room_id !== ids.room_id)
    || (ids.professional_id && groupSlot.data.professional_id !== ids.professional_id)
    || (ids.service_id && groupSlot.data.service_id !== ids.service_id))) {
    return fail(context, 400, "INVALID_GROUP_SLOT_SCOPE", "A turma não corresponde à clínica, unidade, sala, profissional e serviço informados.");
  }

  return null;
}

async function professionalForUser(context: Parameters<typeof ok>[0]) {
  const { data } = await context.get("db").from("professionals").select("id")
    .eq("clinic_id", context.get("profile").clinic_id).eq("profile_id", context.get("user").id).is("deleted_at", null).maybeSingle();
  return data?.id as string | undefined;
}

async function isOwnProfessional(context: Parameters<typeof ok>[0], professionalId: string) {
  const ownId = await professionalForUser(context);
  return Boolean(ownId && ownId === professionalId);
}

function requireRoles(roles: Role[]) {
  return async (context: Parameters<typeof ok>[0], next: () => Promise<void>) => {
    if (!roles.includes(context.get("profile").role)) {
      return fail(context, 403, "FORBIDDEN", "Seu perfil não possui permissão para esta operação.");
    }
    const module = moduleForPath(context.req.path, context.req.method);
    if (module && context.get("profile").role !== "admin") {
      const { data, error } = await context.get("db").from("profile_permissions").select("can_view,can_edit").eq("profile_id", context.get("user").id).eq("module", module).maybeSingle();
      const allowed = !error && Boolean(data) && (context.req.method === "GET" ? data.can_view : data.can_edit);
      if (!allowed) return fail(context, 403, "MODULE_FORBIDDEN", context.req.method === "GET" ? "Seu usuário não tem acesso a este módulo." : "Seu usuário não tem permissão para editar este módulo.");
    }
    await next();
  };
}

async function getAuthorizedAppointment(context: Parameters<typeof ok>[0], appointmentId: string) {
  const { data, error } = await context.get("db").from("appointments")
    .select("id,unit_id,professional_id")
    .eq("id", appointmentId)
    .eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return fail(context, 403, "APPOINTMENT_FORBIDDEN", "Você não possui acesso a este atendimento.");
  if (!(await hasUnitAccess(context, data.unit_id))) {
    return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso à unidade deste atendimento.");
  }
  if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, data.professional_id))) {
    return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode operar seus próprios atendimentos.");
  }
  return data;
}

function ok(context: any, data: unknown, status = 200) {
  return context.json({ data, error: null, requestId: context.get("requestId") }, status);
}

function fail(context: any, status: number, code: string, message: string, details?: unknown) {
  return context.json({ data: null, error: { code, message, details }, requestId: context.get("requestId") }, status);
}

function databaseResult(context: any, data: unknown, error: any, status = 200) {
  if (error) {
    console.error(JSON.stringify({ requestId: context.get("requestId"), code: error.code, message: error.message }));
    const conflict = error.code === "23505";
    return fail(context, conflict ? 409 : 400, conflict ? "DUPLICATE" : "DATABASE_ERROR", conflict ? "Este registro já existe." : "Não foi possível salvar os dados.");
  }
  return ok(context, data, status);
}

function transactionalImportResult(
  context: any,
  data: any,
  error: any,
  details: Record<string, unknown> = {},
) {
  if (error) return databaseResult(context, null, error);
  const result = { ...details, ...(data ?? {}) };
  if (data?.status === "failed") {
    return fail(
      context,
      400,
      "IMPORT_BATCH_FAILED",
      "Nenhuma linha foi importada porque o lote apresentou uma falha.",
      result,
    );
  }
  return ok(context, result, 201);
}

async function audit(
  context: any,
  action: string,
  entityType: string,
  entityId: string | null,
  unitId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await context.get("db").from("audit_events").insert({
    clinic_id: context.get("profile").clinic_id,
    unit_id: unitId ?? null,
    user_id: context.get("user").id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    request_id: context.get("requestId"),
    metadata,
  });
}

async function updateClinicResource(
  context: any,
  table: string,
  id: string,
  changes: Record<string, unknown>,
  action: string,
  unitId?: string | null,
) {
  if (!Object.keys(changes).length) {
    return fail(context, 400, "EMPTY_UPDATE", "Informe ao menos uma alteração.");
  }
  if (unitId && !(await hasUnitAccess(context, unitId))) {
    return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso à unidade de destino.");
  }
  const unitColumn = table === "rooms" ? "unit_id" : null;
  if (unitColumn) {
    const { data: current } = await context.get("db").from(table).select(unitColumn)
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).maybeSingle();
    if (!current || !(await hasUnitAccess(context, current[unitColumn]))) {
      return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso à unidade atual deste registro.");
    }
  }
  const { data, error } = await context.get("db").from(table).update({
    ...changes,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null).select().single();
  if (!error && data) {
    await audit(context, action, table.replace(/s$/, ""), id, unitId, {
      changedFields: Object.keys(changes),
    });
  }
  return databaseResult(context, data, error);
}

function requireIdempotency(context: any) {
  const key = context.req.header("idempotency-key");
  if (!key || key.length < 12 || key.length > 120) {
    throw new z.ZodError([{ code: "custom", path: ["idempotency-key"], message: "Idempotency-Key é obrigatório." }]);
  }
  return key;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function firstDueDate(startsAt: string, dueDay?: number) {
  if (!dueDay) return startsAt;
  const [year, month] = startsAt.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

function normalizeAnnual(rows: any[], year: number) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    const matching = rows.filter((row) => row.month === month);
    return {
      month,
      realizedIncomeCents: matching.reduce((sum, row) => sum + Number(row.realized_income_cents), 0),
      realizedExpenseCents: matching.reduce((sum, row) => sum + Number(row.realized_expense_cents), 0),
      expectedIncomeCents: matching.reduce((sum, row) => sum + Number(row.expected_income_cents), 0),
      expectedExpenseCents: matching.reduce((sum, row) => sum + Number(row.expected_expense_cents), 0),
    };
  });
  return {
    year,
    months,
    totals: months.reduce((total, month) => ({
      realizedIncomeCents: total.realizedIncomeCents + month.realizedIncomeCents,
      realizedExpenseCents: total.realizedExpenseCents + month.realizedExpenseCents,
      expectedIncomeCents: total.expectedIncomeCents + month.expectedIncomeCents,
      expectedExpenseCents: total.expectedExpenseCents + month.expectedExpenseCents,
    }), { realizedIncomeCents: 0, realizedExpenseCents: 0, expectedIncomeCents: 0, expectedExpenseCents: 0 }),
  };
}

type NotionPage = {
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: Record<string, any>;
};

async function notionQueryAll(token: string, dataSourceId: string) {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "notion-version": "2025-09-03",
      },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`NOTION_${response.status}:${body.slice(0, 300)}`);
    }
    const body = await response.json();
    pages.push(...(body.results ?? []));
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function notionValue(property: any): unknown {
  if (!property) return null;
  if (property.type === "title" || property.type === "rich_text") {
    return (property[property.type] ?? []).map((part: any) => part.plain_text ?? "").join("");
  }
  if (property.type === "relation") return (property.relation ?? []).map((item: any) => item.id);
  if (property.type === "files") return (property.files ?? []).map((file: any) => ({
    name: file.name,
    url: file.file?.url ?? file.external?.url,
    type: file.type,
  }));
  if (property.type === "date") return property.date?.start ?? null;
  if (property.type === "select" || property.type === "status") return property[property.type]?.name ?? null;
  if (property.type === "multi_select") return (property.multi_select ?? []).map((item: any) => item.name);
  if (["email", "phone_number", "url", "number", "checkbox", "created_time", "last_edited_time"].includes(property.type)) {
    return property[property.type] ?? null;
  }
  return null;
}

function notionPlainPage(page: NotionPage) {
  return {
    id: page.id,
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties: Object.fromEntries(Object.entries(page.properties ?? {}).map(([name, property]) => [name, notionValue(property)])),
  };
}

function notionProp(page: NotionPage, name: string) {
  return notionValue(page.properties?.[name]);
}

function notionText(page: NotionPage, name: string) {
  const value = notionProp(page, name);
  return typeof value === "string" ? value.trim() : "";
}

function notionTitle(page: NotionPage) {
  const title = Object.values(page.properties ?? {}).find((property: any) => property.type === "title");
  const value = notionValue(title);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? digits : undefined;
}

function validateNotionInventory(inventories: Record<string, NotionPage[]>) {
  const issues: Array<{ entityType: string; externalId: string; reason: string }> = [];
  for (const page of inventories.patients ?? []) {
    if (notionTitle(page).length < 3) issues.push({ entityType: "patients", externalId: page.id, reason: "Cliente sem nome válido" });
    const cpf = notionText(page, "CPF");
    if (cpf && !normalizeCpf(cpf)) issues.push({ entityType: "patients", externalId: page.id, reason: "CPF inválido; será importado sem CPF" });
  }
  for (const page of inventories.appointments ?? []) {
    const hasDate = Object.values(page.properties ?? {}).some((property: any) => property.type === "date" && property.date?.start);
    if (!hasDate) issues.push({ entityType: "appointments", externalId: page.id, reason: "Atendimento sem data estruturada" });
  }
  for (const page of inventories.documents ?? []) {
    const files = notionProp(page, "Anexos");
    if (Array.isArray(files) && files.some((file: any) => !file.url)) issues.push({ entityType: "documents", externalId: page.id, reason: "Anexo sem URL temporária" });
  }
  return issues;
}

function prepareNotionImport(
  inventories: Record<string, NotionPage[]>,
  unitId: string,
  validationIssues: Array<{ entityType: string; externalId: string; reason: string }>,
) {
  const issues = [...validationIssues];
  const rows = Object.entries(inventories).flatMap(([entity, pages]) => pages.map((page) => {
    const base = {
      entity,
      external_id: page.id,
      source_url: page.url,
      payload: notionPlainPage(page),
    };
    const name = notionTitle(page);
    if (entity === "professionals") {
      if (name.length < 3) {
        issues.push({ entityType: entity, externalId: page.id, reason: "Fisioterapeuta sem nome válido" });
        return { ...base, status: "pending" };
      }
      return {
        ...base,
        unit_id: unitId,
        values: {
          name,
          council: notionText(page, "Número CREFITO") || null,
          active: notionText(page, "Situação") !== "Inativo",
          migration_source: "notion",
          external_id: page.id,
        },
      };
    }
    if (entity === "patients") {
      if (name.length < 3) return { ...base, status: "pending" };
      const address = notionText(page, "Endereço");
      const notes = [
        notionText(page, "Gênero") ? `Gênero: ${notionText(page, "Gênero")}` : "",
        notionText(page, "Número Convênio") ? `Número do convênio: ${notionText(page, "Número Convênio")}` : "",
        notionText(page, "Status do Cliente") ? `Status original: ${notionText(page, "Status do Cliente")}` : "",
      ].filter(Boolean).join("\n");
      return {
        ...base,
        values: {
          primary_unit_id: unitId,
          name,
          cpf: normalizeCpf(notionText(page, "CPF")) ?? null,
          birth_date: notionText(page, "Dt. Nascimento") || null,
          phone: notionText(page, "Telefone") || null,
          email: notionText(page, "E-mail") || null,
          address: address ? { formatted: address } : {},
          notes: notes || null,
          migration_source: "notion",
          external_id: page.id,
          created_at: notionText(page, "Cadastrado Em") || page.created_time || new Date().toISOString(),
        },
      };
    }
    return { ...base, status: "staged" };
  }));
  return { rows, issues };
}

const adminDeletableResources = ["units", "rooms", "services", "professionals", "plans", "record-templates"] as const;
for (const resource of adminDeletableResources) {
  app.delete(`/${resource}/:id`, requireRoles(["admin"]), async (context) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const deletedAt = new Date().toISOString();
    const { data, error } = await context.get("db").from(resource).update({ active: false, deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select("id").single();
    if (!error && data) await audit(context, `${resource.replace(/s$/, "")}.deleted`, resource.replace(/s$/, ""), id);
    return databaseResult(context, data, error);
  });
}

const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Fisiofit API", version: "1.0.0" },
  servers: [{ url: "/functions/v1/api/v1" }],
  paths: {
    "/patients": { get: { summary: "Lista pacientes" }, post: { summary: "Cadastra paciente" } },
    "/appointments": { get: { summary: "Lista agenda" }, post: { summary: "Cria agendamento com conflito validado" } },
    "/clinical-records": { get: { summary: "Lista prontuário" }, post: { summary: "Cria avaliação ou evolução" } },
    "/payments": { post: { summary: "Registra pagamento transacional e idempotente" } },
    "/financial-entries": { get: { summary: "Lista movimentos" }, post: { summary: "Cria movimento" } },
    "/reports/annual": { get: { summary: "Relatório anual com doze meses" } },
    "/privacy/requests": { get: { summary: "Lista solicitações de titulares" }, post: { summary: "Registra solicitação LGPD" } },
    "/privacy/incidents": { get: { summary: "Lista incidentes de privacidade" }, post: { summary: "Registra incidente" } },
    "/users/{id}": {
      patch: { summary: "Atualiza usuário, preservando a conta proprietária" },
      delete: { summary: "Arquiva usuário, bloqueia o acesso e preserva o histórico" },
    },
    "/users/{id}/resend-access": { post: { summary: "Reenvia um link seguro de definição de senha" } },
    "/users/{id}/password": { post: { summary: "Define a senha diretamente no Supabase Auth" } },
  },
};

Deno.serve(app.fetch);
