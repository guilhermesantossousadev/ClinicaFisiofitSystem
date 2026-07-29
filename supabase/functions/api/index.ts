import { Hono } from "npm:hono@4.7.2";
import { cors } from "npm:hono@4.7.2/cors";
import { createClient, type User } from "npm:@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3.24.2";

type Role = "admin" | "manager" | "reception" | "professional" | "finance";
type Variables = {
  requestId: string;
  user: User;
  profile: {
    id: string;
    clinic_id: string;
    name: string;
    role: Role;
    status: string;
    mfa_required: boolean;
  };
  db: ReturnType<typeof createClient>;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api/v1");
const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "https://clinicafisiofitsabara.com";

app.use("*", cors({
  origin: (origin) =>
    origin === allowedOrigin || origin.startsWith("http://localhost:")
      ? origin
      : allowedOrigin,
  allowHeaders: ["authorization", "content-type", "idempotency-key", "x-request-id"],
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
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return fail(context, 401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, clinic_id, name, role, status, mfa_required")
    .eq("id", authData.user.id)
    .is("deleted_at", null)
    .single();

  if (profileError || !profile || profile.status !== "active") {
    return fail(context, 403, "MEMBERSHIP_INACTIVE", "Seu acesso à clínica não está ativo.");
  }

  const requiresMfa = ["admin", "manager", "finance"].includes(profile.role);
  const accessToken = auth.slice("Bearer ".length);
  if (requiresMfa && jwtClaim(accessToken, "aal") !== "aal2") {
    return fail(context, 403, "MFA_REQUIRED", "Confirme o segundo fator para continuar.");
  }

  context.set("user", authData.user);
  context.set("profile", profile as Variables["profile"]);
  context.set("db", db);
  await next();
});

function jwtClaim(token: string, claim: string): unknown {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded))[claim];
  } catch {
    return undefined;
  }
}

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

const appointmentSchema = z.object({
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
}).refine((value) => value.ends_at > value.starts_at, {
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

app.get("/dashboard", async (context) => {
  const clinicId = context.get("profile").clinic_id;
  const date = z.string().date().default(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  ).parse(context.req.query("date"));
  const startsAt = `${date}T00:00:00-03:00`;
  const endsAt = `${date}T23:59:59.999-03:00`;
  const monthStart = `${date.slice(0, 7)}-01`;
  const db = context.get("db");

  const [patients, appointments, overdueCharges, monthEntries, units] = await Promise.all([
    db.from("patients").select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).is("deleted_at", null),
    db.from("appointments")
      .select("id,status,starts_at,ends_at,patients(id,name),professionals(id,name),services(id,name),units(id,name)")
      .eq("clinic_id", clinicId).gte("starts_at", startsAt).lte("starts_at", endsAt)
      .is("deleted_at", null).order("starts_at"),
    db.from("charges").select("id,amount_cents,paid_cents", { count: "exact" })
      .eq("clinic_id", clinicId).eq("status", "overdue").is("deleted_at", null),
    db.from("financial_entries").select("kind,amount_cents,settled_at")
      .eq("clinic_id", clinicId).gte("competence_date", monthStart).lte("competence_date", date)
      .is("deleted_at", null),
    db.from("units").select("id,name,active").eq("clinic_id", clinicId)
      .is("deleted_at", null).order("name"),
  ]);

  const error =
    patients.error ??
    appointments.error ??
    overdueCharges.error ??
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
    receivedMonthCents: entries
      .filter((entry) => entry.kind === "income" && entry.settled_at)
      .reduce((sum, entry) => sum + Number(entry.amount_cents), 0),
    paidExpensesMonthCents: entries
      .filter((entry) => entry.kind === "expense" && entry.settled_at)
      .reduce((sum, entry) => sum + Number(entry.amount_cents), 0),
    units: units.data ?? [],
  }, error);
});

app.post("/users/invite", requireRoles(["admin"]), async (context) => {
  const input = z.object({
    email: z.string().email(),
    name: z.string().trim().min(3).max(120),
    role: z.enum(["admin", "manager", "reception", "professional", "finance"]),
    unitIds: z.array(z.string().uuid()).default([]),
  }).parse(await context.req.json());
  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${allowedOrigin}/sistema/login`,
    data: { name: input.name },
  });
  if (inviteError || !invited.user) return databaseResult(context, null, inviteError);
  const mfaRequired = ["admin", "manager", "finance"].includes(input.role);
  const { error: profileError } = await context.get("db").from("profiles").insert({
    id: invited.user.id,
    clinic_id: context.get("profile").clinic_id,
    name: input.name,
    role: input.role,
    status: "invited",
    mfa_required: mfaRequired,
  });
  if (profileError) return databaseResult(context, null, profileError);
  if (input.unitIds.length) {
    const { error: unitsError } = await context.get("db").from("profile_units").insert(
      input.unitIds.map((unitId) => ({ profile_id: invited.user.id, unit_id: unitId })),
    );
    if (unitsError) return databaseResult(context, null, unitsError);
  }
  await audit(context, "user.invited", "profile", invited.user.id);
  return ok(context, { id: invited.user.id, email: input.email, status: "invited" }, 201);
});

app.get("/users", requireRoles(["admin", "manager"]), async (context) => {
  const { data, error } = await context.get("db").from("profiles")
    .select("id,name,role,status,mfa_required,created_at,profile_units(unit_id,units(id,name))")
    .eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null)
    .order("name");
  return databaseResult(context, data, error);
});

app.patch("/users/:id", requireRoles(["admin"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(3).max(120).optional(),
    role: z.enum(["admin", "manager", "reception", "professional", "finance"]).optional(),
    status: z.enum(["invited", "active", "blocked"]).optional(),
    unitIds: z.array(z.string().uuid()).optional(),
  }).parse(await context.req.json());
  const { unitIds, ...profileChanges } = input;
  const db = context.get("db");
  const { data, error } = await db.from("profiles").update({
    ...profileChanges,
    ...(input.role ? { mfa_required: ["admin", "manager", "finance"].includes(input.role) } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).select().single();
  if (error) return databaseResult(context, null, error);
  if (unitIds) {
    const { error: removeError } = await db.from("profile_units").delete().eq("profile_id", id);
    if (removeError) return databaseResult(context, null, removeError);
    if (unitIds.length) {
      const { error: insertError } = await db.from("profile_units").insert(
        unitIds.map((unitId) => ({ profile_id: id, unit_id: unitId })),
      );
      if (insertError) return databaseResult(context, null, insertError);
    }
  }
  await audit(context, "user.updated", "profile", id);
  return ok(context, data);
});

app.get("/units", async (context) => {
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

app.get("/rooms", listResource("rooms", "name"));
app.get("/professionals", listResource("professionals", "name"));
app.get("/services", listResource("services", "name"));
app.get("/plans", listResource("plans", "name"));
app.get("/group-slots", listResource("group_slots", "starts_at"));
app.get("/enrollments", listResource("enrollments", "created_at", false));
app.get("/charges", listResource("charges", "due_at", false));
app.get("/payments", listResource("payments", "paid_at", false));
app.get("/commissions", listResource("commissions", "created_at", false));
app.get("/fiscal-documents", listResource("fiscal_documents", "created_at", false));
app.get("/notifications", listResource("notifications", "scheduled_at", false));
app.get("/audit", requireRoles(["admin", "manager"]), listResource("audit_events", "occurred_at", false));

app.post("/rooms", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    unit_id: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    capacity: z.number().int().min(1).max(20).default(7),
  }).parse(await context.req.json());
  return createClinicResource(context, "rooms", input, "room.created", input.unit_id);
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

app.post("/enrollments", requireRoles(["admin", "manager", "reception", "finance"]), async (context) => {
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
  const { data: plan, error: planError } = await db.from("plans").select("id,name,price_cents")
    .eq("id", input.plan_id).eq("clinic_id", context.get("profile").clinic_id).single();
  if (planError || !plan) return databaseResult(context, null, planError);
  const { data, error } = await db.from("enrollments").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
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
  if (chargeError) return databaseResult(context, null, chargeError);
  await audit(context, "enrollment.created", "enrollment", data.id, input.unit_id);
  return ok(context, data, 201);
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

app.get("/patients", async (context) => {
  const page = positiveInt(context.req.query("page"), 1);
  const pageSize = Math.min(positiveInt(context.req.query("pageSize"), 25), 100);
  const search = context.req.query("search")?.trim();
  let query = context.get("db").from("patients")
    .select("id,name,cpf,birth_date,phone,email,primary_unit_id,created_at", { count: "exact" })
    .is("deleted_at", null);
  if (search) query = query.ilike("name", `%${escapeLike(search)}%`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("name").range(from, from + pageSize - 1);
  return databaseResult(context, { items: data ?? [], page, pageSize, total: count ?? 0 }, error);
});

app.post("/patients", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const input = patientSchema.parse(await context.req.json());
  const { data, error } = await context.get("db").from("patients").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, "patient.created", "patient", data.id, data.primary_unit_id);
  return databaseResult(context, data, error, 201);
});

app.patch("/patients/:id", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = patientSchema.partial().parse(await context.req.json());
  const { data, error } = await context.get("db").from("patients").update({
    ...input,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null)
    .select().single();
  if (!error && data) await audit(context, "patient.updated", "patient", id, data.primary_unit_id);
  return databaseResult(context, data, error);
});

app.get("/patients/:id/responsibles", async (context) => {
  const patientId = z.string().uuid().parse(context.req.param("id"));
  const { data, error } = await context.get("db").from("responsibles").select("*")
    .eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", patientId)
    .is("deleted_at", null).order("name");
  return databaseResult(context, data, error);
});

app.post("/patients/:id/responsibles", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const patientId = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(3).max(160),
    relationship: z.string().max(60).optional(),
    cpf: z.string().max(14).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().optional(),
  }).parse(await context.req.json());
  return createClinicResource(context, "responsibles", { ...input, patient_id: patientId }, "responsible.created");
});

app.get("/patients/:id/consents", async (context) => {
  const patientId = z.string().uuid().parse(context.req.param("id"));
  const { data, error } = await context.get("db").from("consents").select("*")
    .eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return databaseResult(context, data, error);
});

app.post("/patients/:id/consents", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const patientId = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    kind: z.string().trim().min(2).max(80),
    granted: z.boolean(),
  }).parse(await context.req.json());
  return createClinicResource(context, "consents", {
    ...input,
    patient_id: patientId,
    granted_at: input.granted ? new Date().toISOString() : null,
    revoked_at: input.granted ? null : new Date().toISOString(),
  }, "consent.recorded");
});

app.get("/patients/:id/timeline", async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const db = context.get("db");
  const [appointments, records, charges] = await Promise.all([
    db.from("appointments").select("*").eq("patient_id", id).is("deleted_at", null).order("starts_at", { ascending: false }),
    db.from("clinical_records").select("id,kind,status,signed_at,created_at,unit_id,professional_id").eq("patient_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("charges").select("*").eq("patient_id", id).is("deleted_at", null).order("due_at", { ascending: false }),
  ]);
  const error = appointments.error ?? records.error ?? charges.error;
  if (!error) await audit(context, "patient.timeline.viewed", "patient", id);
  return databaseResult(context, {
    appointments: appointments.data ?? [],
    records: records.data ?? [],
    charges: charges.data ?? [],
  }, error);
});

app.get("/appointments", async (context) => {
  const from = z.string().datetime({ offset: true }).parse(context.req.query("from"));
  const to = z.string().datetime({ offset: true }).parse(context.req.query("to"));
  const unit = context.req.query("unitId");
  const professional = context.req.query("professionalId");
  let query = context.get("db").from("appointments")
    .select("*,patients(id,name),professionals(id,name),services(id,name,color),rooms(id,name)")
    .gte("starts_at", from).lt("starts_at", to).is("deleted_at", null);
  if (unit) query = query.eq("unit_id", z.string().uuid().parse(unit));
  if (professional) query = query.eq("professional_id", z.string().uuid().parse(professional));
  const { data, error } = await query.order("starts_at");
  return databaseResult(context, data, error);
});

app.post("/appointments", requireRoles(["admin", "manager", "reception", "professional"]), async (context) => {
  const input = appointmentSchema.parse(await context.req.json());
  const db = context.get("db");
  const { data: conflict, error: conflictError } = await db.rpc("check_appointment_conflict", {
    p_unit_id: input.unit_id,
    p_professional_id: input.professional_id,
    p_room_id: input.room_id ?? null,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_exclude_id: null,
    p_group_slot_id: input.group_slot_id ?? null,
  });
  if (conflictError) return databaseResult(context, null, conflictError);
  if (conflict?.conflict) return fail(context, 409, "SCHEDULE_CONFLICT", "Profissional ou sala já possui compromisso nesse horário.");
  if (conflict?.capacity_reached) return fail(context, 409, "GROUP_CAPACITY_REACHED", "A turma já atingiu a capacidade configurada.");
  const { data, error } = await db.from("appointments").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
    status: "scheduled",
  }).select().single();
  if (!error && data) await audit(context, "appointment.created", "appointment", data.id, data.unit_id);
  return databaseResult(context, data, error, 201);
});

app.patch("/appointments/:id/status", requireRoles(["admin", "manager", "reception", "professional"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    status: z.enum(["scheduled", "confirmed", "attending", "missed", "cancelled"]),
    notes: z.string().max(1000).optional(),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("appointments").update({
    ...input,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null)
    .select().single();
  if (!error && data) await audit(context, `appointment.${input.status}`, "appointment", id, data.unit_id);
  return databaseResult(context, data, error);
});

app.post("/group-slots", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    unit_id: z.string().uuid(),
    room_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    service_id: z.string().uuid(),
    name: z.string().trim().min(3).max(100),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    starts_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    duration_minutes: z.number().int().min(15).max(240),
    capacity: z.number().int().min(3).max(7).default(7),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("group_slots").insert({
    ...input,
    weekdays: [...new Set(input.weekdays)].sort(),
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, "group_slot.created", "group_slot", data.id, data.unit_id);
  return databaseResult(context, data, error, 201);
});

app.post("/group-slots/:id/members", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const groupSlotId = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    enrollment_id: z.string().uuid(),
    patient_id: z.string().uuid(),
    starts_at: z.string().date(),
    ends_at: z.string().date().optional(),
  }).parse(await context.req.json());
  const db = context.get("db");
  const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,capacity").eq("id", groupSlotId).single();
  if (slotError || !slot) return databaseResult(context, null, slotError);
  const { count, error: countError } = await db.from("group_slot_memberships").select("id", { count: "exact", head: true })
    .eq("group_slot_id", groupSlotId).eq("status", "active").is("deleted_at", null);
  if (countError) return databaseResult(context, null, countError);
  if ((count ?? 0) >= slot.capacity) return fail(context, 409, "GROUP_CAPACITY_REACHED", "A turma já atingiu a capacidade configurada.");
  const { data, error } = await db.from("group_slot_memberships").insert({
    ...input,
    group_slot_id: groupSlotId,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, "group_slot.member_added", "group_slot_membership", data.id, slot.unit_id);
  return databaseResult(context, data, error, 201);
});

app.post("/appointments/:id/complete", requireRoles(["admin", "manager", "professional"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const { data, error } = await context.get("db").rpc("complete_appointment", {
    p_appointment_id: id,
    p_request_id: context.get("requestId"),
  });
  return databaseResult(context, data, error);
});

app.get("/clinical-records", requireRoles(["admin", "manager", "professional"]), async (context) => {
  const patientId = z.string().uuid().parse(context.req.query("patientId"));
  const { data, error } = await context.get("db").from("clinical_records")
    .select("*").eq("patient_id", patientId).is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!error) await audit(context, "clinical_records.viewed", "patient", patientId);
  return databaseResult(context, data, error);
});

app.post("/clinical-records", requireRoles(["admin", "manager", "professional"]), async (context) => {
  const input = clinicalRecordSchema.parse(await context.req.json());
  const { data, error } = await context.get("db").from("clinical_records").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
    status: "draft",
  }).select().single();
  if (!error && data) await audit(context, "clinical_record.created", "clinical_record", data.id, data.unit_id);
  return databaseResult(context, data, error, 201);
});

app.post("/clinical-records/:id/sign", requireRoles(["admin", "manager", "professional"]), async (context) => {
  requireIdempotency(context);
  const id = z.string().uuid().parse(context.req.param("id"));
  const db = context.get("db");
  const { data: record, error: readError } = await db.from("clinical_records").select("*").eq("id", id).eq("status", "draft").single();
  if (readError || !record) return databaseResult(context, null, readError);
  const canonical = JSON.stringify({ id: record.id, payload: record.payload, created_at: record.created_at });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const signatureHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await db.from("clinical_records").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signed_by: context.get("user").id,
    signature_hash: signatureHash,
  }).eq("id", id).eq("status", "draft").select().single();
  if (!error && data) await audit(context, "clinical_record.signed", "clinical_record", data.id, data.unit_id);
  return databaseResult(context, data, error);
});

app.post("/clinical-records/:id/rectify", requireRoles(["admin", "manager", "professional"]), async (context) => {
  const originalId = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    reason: z.string().trim().min(10).max(1000),
    payload: z.record(z.unknown()),
  }).parse(await context.req.json());
  const db = context.get("db");
  const { data: original, error: originalError } = await db.from("clinical_records").select("*")
    .eq("id", originalId).eq("clinic_id", context.get("profile").clinic_id).eq("status", "signed").single();
  if (originalError || !original) return databaseResult(context, null, originalError);
  const { data, error } = await db.from("clinical_records").insert({
    clinic_id: original.clinic_id,
    patient_id: original.patient_id,
    appointment_id: original.appointment_id,
    professional_id: original.professional_id,
    unit_id: original.unit_id,
    kind: "rectification",
    template_id: original.template_id,
    template_version: original.template_version,
    payload: input.payload,
    status: "draft",
    rectifies_id: originalId,
    rectification_reason: input.reason,
  }).select().single();
  if (!error && data) await audit(context, "clinical_record.rectified", "clinical_record", data.id, data.unit_id);
  return databaseResult(context, data, error, 201);
});

app.post("/payments", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const key = requireIdempotency(context);
  const input = z.object({
    charge_id: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    method: z.enum(["pix", "card", "cash", "transfer"]),
    paid_at: z.string().datetime({ offset: true }),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").rpc("register_payment", {
    p_charge_id: input.charge_id,
    p_amount_cents: input.amount_cents,
    p_method: input.method,
    p_paid_at: input.paid_at,
    p_idempotency_key: key,
    p_request_id: context.get("requestId"),
  });
  return databaseResult(context, data, error, 201);
});

app.get("/financial-entries", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const from = z.string().date().parse(context.req.query("from"));
  const to = z.string().date().parse(context.req.query("to"));
  const unit = context.req.query("unitId");
  let query = context.get("db").from("financial_entries").select("*")
    .gte("competence_date", from).lte("competence_date", to).is("deleted_at", null);
  if (unit) query = query.eq("unit_id", z.string().uuid().parse(unit));
  const { data, error } = await query.order("competence_date", { ascending: false });
  return databaseResult(context, data, error);
});

app.post("/financial-entries", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = financialEntrySchema.parse(await context.req.json());
  const { data, error } = await context.get("db").from("financial_entries").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, "financial_entry.created", "financial_entry", data.id, data.unit_id);
  return databaseResult(context, data, error, 201);
});

app.post("/commissions", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = z.object({
    unit_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    appointment_id: z.string().uuid().optional(),
    payment_id: z.string().uuid().optional(),
    amount_cents: z.number().int().nonnegative(),
    basis: z.enum(["appointment", "payment"]),
  }).parse(await context.req.json());
  return createClinicResource(context, "commissions", { ...input, status: "pending" }, "commission.created", input.unit_id);
});

app.post("/commissions/:id/approve", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const db = context.get("db");
  const { data, error } = await db.from("commissions").update({
    status: "approved",
    approved_by: context.get("user").id,
    approved_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).eq("status", "pending")
    .select().single();
  if (error || !data) return databaseResult(context, null, error);
  const { error: entryError } = await db.from("financial_entries").insert({
    clinic_id: context.get("profile").clinic_id,
    unit_id: data.unit_id,
    kind: "expense",
    description: "Comissão profissional aprovada",
    category: "Comissões",
    cost_center: "Equipe",
    amount_cents: Math.max(data.amount_cents, 1),
    competence_date: new Date().toISOString().slice(0, 10),
  });
  if (entryError) return databaseResult(context, null, entryError);
  await audit(context, "commission.approved", "commission", id, data.unit_id);
  return ok(context, data);
});

app.get("/closings", requireRoles(["admin", "manager", "finance"]), listResource("monthly_closings", "reference_month", false));

app.post("/closings", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const input = z.object({
    unit_id: z.string().uuid().optional(),
    reference_month: z.string().regex(/^\d{4}-\d{2}$/),
  }).parse(await context.req.json());
  const db = context.get("db");
  const month = `${input.reference_month}-01`;
  let summaryQuery = db.from("monthly_financial_summary").select("*").eq("month", month);
  if (input.unit_id) summaryQuery = summaryQuery.eq("unit_id", input.unit_id);
  const { data: summary, error: summaryError } = await summaryQuery;
  if (summaryError) return databaseResult(context, null, summaryError);
  const { data: latest } = await db.from("monthly_closings").select("version")
    .eq("clinic_id", context.get("profile").clinic_id)
    .eq("reference_month", month)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db.from("monthly_closings").insert({
    clinic_id: context.get("profile").clinic_id,
    unit_id: input.unit_id ?? null,
    reference_month: month,
    version: (latest?.version ?? 0) + 1,
    snapshot: { rows: summary ?? [] },
    status: "closed",
    closed_by: context.get("user").id,
    closed_at: new Date().toISOString(),
  }).select().single();
  if (!error && data) await audit(context, "closing.created", "monthly_closing", data.id, input.unit_id);
  return databaseResult(context, data, error, 201);
});

app.get("/reports/annual", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const year = z.coerce.number().int().min(2020).max(2100).parse(context.req.query("year"));
  const unit = context.req.query("unitId");
  let query = context.get("db").from("monthly_financial_summary").select("*")
    .gte("month", `${year}-01-01`).lte("month", `${year}-12-31`);
  if (unit) query = query.eq("unit_id", z.string().uuid().parse(unit));
  const { data, error } = await query.order("month");
  if (!error) await audit(context, "report.annual.viewed", "report", null, unit);
  return databaseResult(context, normalizeAnnual(data ?? [], year), error);
});

app.get("/reports/monthly", requireRoles(["admin", "manager", "finance"]), async (context) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(context.req.query("month"));
  const unit = context.req.query("unitId");
  let query = context.get("db").from("monthly_financial_summary").select("*").eq("month", `${month}-01`);
  if (unit) query = query.eq("unit_id", z.string().uuid().parse(unit));
  const { data, error } = await query;
  return databaseResult(context, data, error);
});

app.post("/imports", requireRoles(["admin", "manager"]), async (context) => {
  const key = requireIdempotency(context);
  const input = z.object({
    source: z.enum(["oluma", "notion", "manual"]),
    filename: z.string().min(1).max(240),
    mapping: z.record(z.string()).default({}),
  }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("import_batches").insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
    created_by: context.get("user").id,
    idempotency_key: key,
    status: "uploaded",
  }).select().single();
  return databaseResult(context, data, error, 201);
});

app.get("/imports", requireRoles(["admin", "manager"]), listResource("import_batches", "created_at", false));

app.post("/imports/patients", requireRoles(["admin", "manager"]), async (context) => {
  const key = requireIdempotency(context);
  const input = z.object({
    source: z.enum(["oluma", "notion", "manual"]),
    filename: z.string().min(1).max(240),
    unit_id: z.string().uuid(),
    dryRun: z.boolean().default(true),
    rows: z.array(z.object({
      external_id: z.string().max(120).optional(),
      name: z.string().trim().min(3).max(160),
      cpf: z.string().trim().min(11).max(14).optional(),
      birth_date: z.string().date().optional(),
      phone: z.string().max(20).optional(),
      email: z.string().email().optional(),
      notes: z.string().max(4000).optional(),
    })).min(1).max(2000),
  }).parse(await context.req.json());
  const db = context.get("db");
  const cpfs = input.rows.flatMap((row) => row.cpf ? [row.cpf] : []);
  const { data: existing, error: existingError } = cpfs.length
    ? await db.from("patients").select("cpf").eq("clinic_id", context.get("profile").clinic_id).in("cpf", cpfs).is("deleted_at", null)
    : { data: [], error: null };
  if (existingError) return databaseResult(context, null, existingError);
  const existingCpfs = new Set((existing ?? []).map((row) => row.cpf));
  const seenCpfs = new Set<string>();
  const rejected: Array<{ row: number; reason: string }> = [];
  const accepted = input.rows.filter((row, index) => {
    if (row.cpf && (existingCpfs.has(row.cpf) || seenCpfs.has(row.cpf))) {
      rejected.push({ row: index + 2, reason: "CPF duplicado" });
      return false;
    }
    if (row.cpf) seenCpfs.add(row.cpf);
    return true;
  });
  if (input.dryRun) return ok(context, { accepted: accepted.length, rejected, total: input.rows.length });

  const { data: batch, error: batchError } = await db.from("import_batches").insert({
    clinic_id: context.get("profile").clinic_id,
    source: input.source,
    filename: input.filename,
    mapping: {},
    status: "processing",
    totals: { total: input.rows.length, accepted: accepted.length, rejected: rejected.length },
    idempotency_key: key,
    created_by: context.get("user").id,
  }).select().single();
  if (batchError || !batch) return databaseResult(context, null, batchError);
  const { data, error } = await db.from("patients").insert(accepted.map((row) => ({
    ...row,
    clinic_id: context.get("profile").clinic_id,
    primary_unit_id: input.unit_id,
    migration_source: input.source,
  }))).select("id");
  await db.from("import_batches").update({
    status: error ? "failed" : "completed",
    totals: { total: input.rows.length, imported: data?.length ?? 0, rejected: rejected.length },
    updated_at: new Date().toISOString(),
  }).eq("id", batch.id);
  if (!error) await audit(context, "import.patients.completed", "import_batch", batch.id, input.unit_id);
  return databaseResult(context, { batchId: batch.id, imported: data?.length ?? 0, rejected }, error, 201);
});

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
  const { data, error } = await context.get("db").from(table).insert({
    ...input,
    clinic_id: context.get("profile").clinic_id,
  }).select().single();
  if (!error && data) await audit(context, action, table.replace(/s$/, ""), data.id, unitId);
  return databaseResult(context, data, error, 201);
}

function requireRoles(roles: Role[]) {
  return async (context: Parameters<typeof ok>[0], next: () => Promise<void>) => {
    if (!roles.includes(context.get("profile").role)) {
      return fail(context, 403, "FORBIDDEN", "Seu perfil não possui permissão para esta operação.");
    }
    await next();
  };
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

async function audit(context: any, action: string, entityType: string, entityId: string | null, unitId?: string | null) {
  await context.get("db").from("audit_events").insert({
    clinic_id: context.get("profile").clinic_id,
    unit_id: unitId ?? null,
    user_id: context.get("user").id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    request_id: context.get("requestId"),
  });
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
  },
};

Deno.serve(app.fetch);
