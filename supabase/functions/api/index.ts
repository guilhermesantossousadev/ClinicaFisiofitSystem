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
  const unitId = context.req.query("unitId");
  const db = context.get("db");

  const [patients, appointments, overdueCharges, monthEntries, units] = await Promise.all([
    (() => { let query = db.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).is("deleted_at", null); if (unitId) query = query.eq("primary_unit_id", unitId); return query; })(),
    (() => { let query = db.from("appointments").select("id,status,starts_at,ends_at,patients(id,name),professionals(id,name),services(id,name),units(id,name)").eq("clinic_id", clinicId).gte("starts_at", startsAt).lte("starts_at", endsAt).is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query.order("starts_at"); })(),
    (() => { let query = db.from("charges").select("id,amount_cents,paid_cents", { count: "exact" }).eq("clinic_id", clinicId).eq("status", "overdue").is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query; })(),
    (() => { let query = db.from("financial_entries").select("kind,amount_cents,settled_at").eq("clinic_id", clinicId).gte("competence_date", monthStart).lte("competence_date", date).is("deleted_at", null); if (unitId) query = query.eq("unit_id", unitId); return query; })(),
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
    redirectTo: `${allowedOrigin}/sistema/set-password`,
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

app.post("/users/:id/resend-access", requireRoles(["admin"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const db = context.get("db");
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id,status").eq("id", id).eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null).single();
  if (profileError || !profile) return databaseResult(context, null, profileError);
  if (profile.status === "blocked") {
    return fail(context, 409, "MEMBERSHIP_BLOCKED", "Ative a conta antes de reenviar o acesso.");
  }
  const url = requiredEnv("SUPABASE_URL");
  const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(id);
  if (userError) return databaseResult(context, null, userError);
  if (!authUser.user?.email) {
    return fail(context, 404, "USER_EMAIL_NOT_FOUND", "Não foi possível localizar o e-mail desta conta.");
  }
  const authClient = createClient(url, requiredEnv("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  const { error: resendError } = await authClient.auth.resetPasswordForEmail(authUser.user.email, {
    redirectTo: `${allowedOrigin}/sistema/set-password`,
  });
  if (resendError) return databaseResult(context, null, resendError);
  await audit(context, "user.access_resent", "profile", id);
  return ok(context, { id, email: authUser.user.email });
});

app.get("/users", requireRoles(["admin", "manager"]), async (context) => {
  const db = context.get("db");
  const clinicId = context.get("profile").clinic_id;
  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const [{ data, error }, { data: clinic, error: clinicError }, { data: authUsers, error: authError }] = await Promise.all([
    db.from("profiles")
    .select("id,name,role,status,mfa_required,created_at,profile_units(unit_id,units(id,name))")
    .eq("clinic_id", clinicId).is("deleted_at", null).order("name"),
    db.from("clinics").select("owner_profile_id").eq("id", clinicId).single(),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emails = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? ""]));
  return databaseResult(context, (data ?? []).map((profile) => ({
    ...profile,
    email: emails.get(profile.id) ?? "",
    is_owner: profile.id === clinic?.owner_profile_id,
  })), error ?? clinicError ?? authError);
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
  const clinicId = context.get("profile").clinic_id;
  const { data: clinic, error: clinicError } = await db.from("clinics")
    .select("owner_profile_id").eq("id", clinicId).single();
  if (clinicError) return databaseResult(context, null, clinicError);
  const ownerMutation = id === clinic?.owner_profile_id && (
    (input.role !== undefined && input.role !== "admin")
    || (input.status !== undefined && input.status !== "active")
    || input.unitIds !== undefined
  );
  if (ownerMutation) {
    await audit(context, "owner.change_blocked", "profile", id, null, {
      attemptedFields: Object.keys(input),
    });
    return fail(context, 409, "PROTECTED_OWNER_ACCOUNT", "A conta proprietária não pode ser bloqueada, rebaixada ou removida da clínica.");
  }
  const { data, error } = await db.from("profiles").update({
    ...profileChanges,
    ...(input.role ? { mfa_required: ["admin", "manager", "finance"].includes(input.role) } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", clinicId).select().single();
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

app.delete("/users/:id", requireRoles(["admin"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const clinicId = context.get("profile").clinic_id;
  if (id === context.get("profile").id) {
    return fail(context, 409, "CURRENT_ACCOUNT_PROTECTED", "Você não pode excluir a conta que está usando.");
  }
  const db = context.get("db");
  const { data: clinic, error: clinicError } = await db.from("clinics")
    .select("owner_profile_id").eq("id", clinicId).single();
  if (clinicError) return databaseResult(context, null, clinicError);
  if (id === clinic?.owner_profile_id) {
    return fail(context, 409, "PROTECTED_OWNER_ACCOUNT", "A conta proprietária não pode ser excluída.");
  }
  const deletedAt = new Date().toISOString();
  const { data, error } = await db.from("profiles").update({
    status: "blocked",
    deleted_at: deletedAt,
    updated_at: deletedAt,
  }).eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).select("id").single();
  if (error) return databaseResult(context, null, error);
  const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (banError) {
    await db.from("profiles").update({ status: "blocked", deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", id).eq("clinic_id", clinicId);
    return databaseResult(context, null, banError);
  }
  await audit(context, "user.deleted", "profile", id);
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
app.get("/privacy/requests", requireRoles(["admin", "manager"]), listResource("data_subject_requests", "created_at", false));
app.get("/privacy/incidents", requireRoles(["admin"]), listResource("privacy_incidents", "created_at", false));

app.post("/privacy/requests", requireRoles(["admin", "manager"]), async (context) => {
  const input = z.object({
    patient_id: z.string().uuid().optional(),
    requester_name: z.string().trim().min(3).max(160),
    requester_email: z.string().email().optional(),
    requester_phone: z.string().min(10).max(20).optional(),
    kind: z.enum(["confirmation","access","correction","sharing","opposition","portability","revocation","deletion"]),
  }).refine((value) => value.requester_email || value.requester_phone, {
    message: "Informe e-mail ou telefone.",
  }).parse(await context.req.json());
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 15);
  return createClinicResource(context, "data_subject_requests", {
    ...input,
    due_at: dueAt.toISOString(),
  }, "privacy.request.created");
});

app.patch("/privacy/requests/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    status: z.enum(["received","identity_check","in_review","fulfilled","partially_fulfilled","rejected","cancelled"]),
    identity_verified: z.boolean().optional(),
    decision_reason: z.string().max(4000).optional(),
  }).parse(await context.req.json());
  const { identity_verified, ...changes } = input;
  const completed = ["fulfilled","partially_fulfilled","rejected","cancelled"].includes(input.status);
  const { data, error } = await context.get("db").from("data_subject_requests").update({
    ...changes,
    ...(identity_verified ? { identity_verified_at: new Date().toISOString() } : {}),
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).select().single();
  if (!error) await audit(context, "privacy.request.updated", "data_subject_request", id, null, { status: input.status });
  return databaseResult(context, data, error);
});

app.post("/privacy/incidents", requireRoles(["admin"]), async (context) => {
  const input = z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(10000),
    severity: z.enum(["low","medium","high","critical"]),
    discovered_at: z.string().datetime({ offset: true }),
    data_categories: z.array(z.string().min(2).max(80)).default([]),
    affected_count: z.number().int().nonnegative().optional(),
    risk_assessment: z.string().max(4000).optional(),
    mitigation: z.string().max(4000).optional(),
  }).parse(await context.req.json());
  return createClinicResource(context, "privacy_incidents", {
    ...input,
    created_by: context.get("user").id,
  }, "privacy.incident.created");
});

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

app.get("/patients", async (context) => {
  const clinicId = context.get("profile").clinic_id;
  const page = positiveInt(context.req.query("page"), 1);
  const pageSize = Math.min(positiveInt(context.req.query("pageSize"), 25), 100);
  const search = context.req.query("search")?.trim().replace(/[,()%]/g, "");
  let query = context.get("db").from("patients")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .is("deleted_at", null);
  if (search) {
    const term = escapeLike(search);
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,cpf.ilike.%${term}%`);
  }
  const unitId = context.req.query("unitId");
  if (unitId) query = query.eq("primary_unit_id", z.string().uuid().parse(unitId));
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("name").range(from, from + pageSize - 1);
  return databaseResult(context, { items: data ?? [], page, pageSize, total: count ?? 0 }, error);
});

app.get("/patients/:id", async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const { data, error } = await context.get("db").from("patients").select("*")
    .eq("id", id).eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null).single();
  if (!error && data) await audit(context, "patient.viewed", "patient", id, data.primary_unit_id);
  return databaseResult(context, data, error);
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
  const input = patientSchema.partial().extend({ active: z.boolean().optional() }).parse(await context.req.json());
  const { data, error } = await context.get("db").from("patients").update({
    ...input,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null)
    .select().single();
  if (!error && data) await audit(context, "patient.updated", "patient", id, data.primary_unit_id);
  return databaseResult(context, data, error);
});

app.delete("/patients/:id", requireRoles(["admin", "manager", "reception"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const deletedAt = new Date().toISOString();
  const { data, error } = await context.get("db").from("patients").update({
    active: false,
    deleted_at: deletedAt,
    updated_at: deletedAt,
  }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id)
    .is("deleted_at", null).select("id,primary_unit_id").single();
  if (!error && data) await audit(context, "patient.deleted", "patient", id, data.primary_unit_id);
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
    purpose: z.string().trim().min(3).max(240),
    legal_basis: z.string().trim().min(3).max(120),
    notice_version: z.string().trim().min(1).max(40),
    source: z.enum(["portal","paper","email","whatsapp","import"]).default("portal"),
    metadata: z.record(z.unknown()).default({}),
  }).parse(await context.req.json());
  return createClinicResource(context, "consents", {
    ...input,
    patient_id: patientId,
    granted_at: input.granted ? new Date().toISOString() : null,
    revoked_at: input.granted ? null : new Date().toISOString(),
    recorded_by: context.get("user").id,
  }, "consent.recorded");
});

app.get("/patients/:id/timeline", async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const db = context.get("db");
  const clinicId = context.get("profile").clinic_id;
  const [appointments, records, charges] = await Promise.all([
    db.from("appointments").select("*").eq("clinic_id", clinicId).eq("patient_id", id).is("deleted_at", null).order("starts_at", { ascending: false }),
    db.from("clinical_records").select("id,kind,status,signed_at,created_at,unit_id,professional_id").eq("clinic_id", clinicId).eq("patient_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("charges").select("*").eq("clinic_id", clinicId).eq("patient_id", id).is("deleted_at", null).order("due_at", { ascending: false }),
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
    .eq("clinic_id", context.get("profile").clinic_id)
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

app.patch("/group-slots/:id", requireRoles(["admin", "manager"]), async (context) => {
  const id = z.string().uuid().parse(context.req.param("id"));
  const input = z.object({
    name: z.string().trim().min(3).max(120).optional(),
    starts_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    duration_minutes: z.number().int().min(15).max(240).optional(),
    capacity: z.number().int().min(1).max(7).optional(),
    active: z.boolean().optional(),
  }).parse(await context.req.json());
  return updateClinicResource(context, "group_slots", id, input, "group_slot.updated");
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
  const clinicId = context.get("profile").clinic_id;
  const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,capacity")
    .eq("id", groupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
  if (slotError || !slot) return databaseResult(context, null, slotError);
  const { count, error: countError } = await db.from("group_slot_memberships").select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("status", "active").is("deleted_at", null);
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
    .select("*").eq("clinic_id", context.get("profile").clinic_id)
    .eq("patient_id", patientId).is("deleted_at", null)
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
  const clinicId = context.get("profile").clinic_id;
  const { data: record, error: readError } = await db.from("clinical_records").select("*")
    .eq("id", id).eq("clinic_id", clinicId).eq("status", "draft").single();
  if (readError || !record) return databaseResult(context, null, readError);
  const canonical = JSON.stringify({ id: record.id, payload: record.payload, created_at: record.created_at });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const signatureHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await db.from("clinical_records").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signed_by: context.get("user").id,
    signature_hash: signatureHash,
  }).eq("id", id).eq("clinic_id", clinicId).eq("status", "draft").select().single();
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
    .eq("clinic_id", context.get("profile").clinic_id)
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

// Workbook imports use one sheet per entity. The aliases intentionally match
// the labels used by Brazilian spreadsheets as well as the database fields.
const workbookEntities = {
  units: { table: "units", required: ["name"], fields: ["name", "phone", "active", "address"] },
  rooms: { table: "rooms", required: ["name", "unit_id"], fields: ["name", "unit_id", "capacity", "active"] },
  professionals: { table: "professionals", required: ["name", "unit_id"], fields: ["name", "council", "specialty", "active"] },
  services: { table: "services", required: ["name", "duration_minutes", "price_cents"], fields: ["name", "duration_minutes", "price_cents", "color", "active"] },
  plans: { table: "plans", required: ["name", "kind", "price_cents"], fields: ["name", "kind", "sessions_included", "duration_days", "price_cents", "active"] },
  patients: { table: "patients", required: ["name", "unit_id"], fields: ["name", "cpf", "birth_date", "phone", "email", "notes", "external_id"] },
  enrollments: { table: "enrollments", required: ["patient_id", "plan_id", "unit_id", "starts_at"], fields: ["patient_id", "plan_id", "unit_id", "starts_at", "ends_at", "due_day", "discount_cents", "surcharge_cents", "status"] },
  appointments: { table: "appointments", required: ["unit_id", "starts_at", "ends_at"], fields: ["unit_id", "patient_id", "professional_id", "service_id", "room_id", "enrollment_id", "starts_at", "ends_at", "status", "notes"] },
  group_slots: { table: "group_slots", required: ["unit_id", "room_id", "professional_id", "service_id", "name", "weekdays", "starts_at", "duration_minutes"], fields: ["unit_id", "room_id", "professional_id", "service_id", "name", "weekdays", "starts_at", "duration_minutes", "capacity", "active"] },
  charges: { table: "charges", required: ["patient_id", "unit_id", "description", "amount_cents", "due_at"], fields: ["patient_id", "enrollment_id", "unit_id", "description", "amount_cents", "due_at", "installment_number", "installment_count", "status"] },
  payments: { table: "payments", required: ["charge_id", "amount_cents", "method", "paid_at"], fields: ["charge_id", "amount_cents", "method", "paid_at", "reversed_at", "receipt_path"] },
  financial_entries: { table: "financial_entries", required: ["unit_id", "kind", "description", "category", "amount_cents", "competence_date"], fields: ["unit_id", "charge_id", "payment_id", "kind", "description", "category", "cost_center", "amount_cents", "competence_date", "settled_at"] },
  commissions: { table: "commissions", required: ["unit_id", "professional_id", "amount_cents", "basis"], fields: ["unit_id", "professional_id", "appointment_id", "payment_id", "amount_cents", "basis", "status"] },
  clinical_records: { table: "clinical_records", required: ["patient_id", "professional_id", "unit_id", "kind", "payload"], fields: ["patient_id", "appointment_id", "professional_id", "unit_id", "kind", "template_id", "template_version", "payload", "status"] },
  record_templates: { table: "record_templates", required: ["name", "kind"], fields: ["name", "kind", "specialty", "schema", "active"] },
} as const;

type WorkbookEntity = keyof typeof workbookEntities;
const workbookAliases: Record<string, string> = {
  unidade: "unit_id", unidade_id: "unit_id", unidade_de_destino: "unit_id", sala: "room_id", sala_id: "room_id",
  profissional: "professional_id", profissional_id: "professional_id", paciente: "patient_id", paciente_id: "patient_id",
  servico: "service_id", servico_id: "service_id", plano: "plan_id", plano_id: "plan_id", matricula: "enrollment_id",
  data_nascimento: "birth_date", nascimento: "birth_date", telefone: "phone", observacoes: "notes", valor: "amount_cents",
  preco: "price_cents", duracao: "duration_minutes", data_inicio: "starts_at", inicio: "starts_at", data_fim: "ends_at",
  fim: "ends_at", vencimento: "due_at", categoria_financeira: "category", data_competencia: "competence_date",
  grupo: "group_slot_id", grupo_id: "group_slot_id", forma_pagamento: "method", pagamento: "payment_id",
};

function workbookKey(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function workbookNumber(value: unknown, cents = false) {
  const number = Number(String(value ?? "").replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", "."));
  return cents && Number.isFinite(number) && number < 100000 ? Math.round(number * 100) : number;
}

async function resolveWorkbookReferences(db: any, clinicId: string, entity: WorkbookEntity, row: Record<string, unknown>) {
  const references: Record<string, [string, string]> = {
    unit_id: ["units", "name"], patient_id: ["patients", "name"], professional_id: ["professionals", "name"],
    service_id: ["services", "name"], plan_id: ["plans", "name"], room_id: ["rooms", "name"], enrollment_id: ["enrollments", "id"],
  };
  for (const [field, [table, label]] of Object.entries(references)) {
    if (!row[field] || /^[0-9a-f-]{36}$/i.test(String(row[field]))) continue;
    let query = db.from(table).select("id").eq("clinic_id", clinicId);
    query = label === "id" ? query.eq("id", row[field]) : query.ilike(label, String(row[field]));
    const { data } = await query.limit(1).maybeSingle();
    if (data?.id) row[field] = data.id;
  }
  return row;
}

app.post("/imports/workbook", requireRoles(["admin", "manager"]), async (context) => {
  const key = requireIdempotency(context);
  const input = z.object({ filename: z.string().min(1).max(240), dryRun: z.boolean().default(true), sheets: z.array(z.object({
    name: z.string().min(1).max(120), entity: z.string(), rows: z.array(z.record(z.unknown())).max(5000),
  })).min(1).max(30) }).parse(await context.req.json());
  const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
  const issues: Array<{ sheet: string; row: number; reason: string }> = []; const prepared: Array<{ entity: WorkbookEntity; values: Record<string, unknown>; sheet: string; row: number }> = [];
  for (const sheet of input.sheets) {
    if (!(sheet.entity in workbookEntities)) { issues.push({ sheet: sheet.name, row: 0, reason: `A entidade “${sheet.entity}” não é suportada.` }); continue; }
    const entity = sheet.entity as WorkbookEntity; const config = workbookEntities[entity];
    for (const [index, raw] of sheet.rows.entries()) {
      const canonical = Object.fromEntries(Object.entries(raw).map(([key, value]) => [workbookAliases[workbookKey(key)] ?? workbookKey(key), value]));
      const values: Record<string, unknown> = {};
      for (const field of config.fields) if (canonical[field] !== undefined && canonical[field] !== "") values[field] = canonical[field];
      if (entity === "patients" && values.unit_id === undefined) values.unit_id = input.sheets.find((candidate) => candidate.entity === "units")?.rows[0]?.name;
      if (["services", "plans", "charges", "financial_entries"].includes(entity)) {
        for (const field of ["price_cents", "amount_cents", "discount_cents", "surcharge_cents"]) if (values[field] !== undefined) values[field] = workbookNumber(values[field], field.endsWith("cents"));
      }
      if (values.duration_minutes !== undefined) values.duration_minutes = workbookNumber(values.duration_minutes);
      if (values.sessions_included !== undefined) values.sessions_included = workbookNumber(values.sessions_included);
      if (values.capacity !== undefined) values.capacity = workbookNumber(values.capacity);
      if (values.weekdays && typeof values.weekdays === "string") values.weekdays = String(values.weekdays).split(/[;,|]/).map((day) => Number(day.trim())).filter((day) => Number.isInteger(day));
      if (values.schema && typeof values.schema === "string") { try { values.schema = JSON.parse(values.schema); } catch { values.schema = {}; } }
      if (values.payload && typeof values.payload === "string") { try { values.payload = JSON.parse(values.payload); } catch { values.payload = { text: values.payload }; } }
      if (values.address && typeof values.address === "string") values.address = { street: values.address };
      await resolveWorkbookReferences(db, clinicId, entity, values);
      for (const required of config.required) if (values[required] === undefined || values[required] === "") issues.push({ sheet: sheet.name, row: index + 2, reason: `Campo obrigatório ausente: ${required}` });
      if (entity === "patients" && values.unit_id && !/^[0-9a-f-]{36}$/i.test(String(values.unit_id))) issues.push({ sheet: sheet.name, row: index + 2, reason: `Unidade não encontrada: ${values.unit_id}` });
      prepared.push({ entity, values, sheet: sheet.name, row: index + 2 });
    }
  }
  if (input.dryRun) return ok(context, { dryRun: true, total: prepared.length, accepted: prepared.filter((item) => !issues.some((issue) => issue.sheet === item.sheet && issue.row === item.row)).length, issues });
  const valid = prepared.filter((item) => !issues.some((issue) => issue.sheet === item.sheet && issue.row === item.row));
  const { data: batch, error: batchError } = await db.from("import_batches").insert({ clinic_id: clinicId, source: "manual", filename: input.filename, mapping: { sheets: input.sheets.map((sheet) => ({ name: sheet.name, entity: sheet.entity })) }, status: "processing", totals: { total: prepared.length }, errors: issues, idempotency_key: key, created_by: context.get("user").id }).select().single();
  if (batchError || !batch) return databaseResult(context, null, batchError);
  const imported: Record<string, number> = {}; const insertErrors: Array<{ sheet: string; row: number; reason: string }> = [];
  for (const entity of Object.keys(workbookEntities) as WorkbookEntity[]) {
    const group = valid.filter((item) => item.entity === entity); if (!group.length) continue;
    const rows = group.map((item) => {
      const values = { ...item.values };
      if (entity === "professionals") delete values.unit_id;
      if (entity === "patients") { values.primary_unit_id = values.unit_id; delete values.unit_id; values.migration_source = "manual"; }
      if (entity === "payments") values.idempotency_key = `${key}-${item.sheet}-${item.row}`;
      return { ...values, clinic_id: clinicId };
    });
    const { data, error } = await db.from(workbookEntities[entity].table).insert(rows).select("id");
    if (error) insertErrors.push(...group.map((item) => ({ sheet: item.sheet, row: item.row, reason: error.message })));
    else {
      imported[entity] = data?.length ?? 0;
      if (entity === "professionals" && data) {
        const links = data.map((professional: { id: string }, index: number) => ({ professional_id: professional.id, unit_id: group[index].values.unit_id }));
        const { error: linkError } = await db.from("professional_units").insert(links);
        if (linkError) insertErrors.push(...group.map((item) => ({ sheet: item.sheet, row: item.row, reason: linkError.message })));
      }
    }
  }
  const allErrors = [...issues, ...insertErrors]; await db.from("import_batches").update({ status: insertErrors.length ? "failed" : "completed", totals: { total: prepared.length, imported }, errors: allErrors, updated_at: new Date().toISOString() }).eq("id", batch.id);
  await audit(context, "import.workbook.completed", "import_batch", batch.id, null, { imported, errors: allErrors.length });
  return ok(context, { batchId: batch.id, imported, issues: allErrors }, 201);
});

const notionSources = {
  professionals: "2ffff160-df01-81dd-bec9-000bb99f953b",
  insurance_providers: "2ffff160-df01-81ff-afcf-000b7f66b9dc",
  lead_sources: "2ffff160-df01-8166-bfd5-000b3fdc3e09",
  financial_categories: "2ffff160-df01-81ac-98f6-000b680d1941",
  message_templates: "2ffff160-df01-81de-9beb-000b32d4c390",
  documents: "2ffff160-df01-818e-b28a-000bffc74584",
  patients: "2ffff160-df01-81aa-8191-000b099bfc19",
  appointments: "2ffff160-df01-81d0-8764-000bb05b1e92",
  enrollments: "2ffff160-df01-81c2-a005-000bc3907333",
  financial_entries: "2ffff160-df01-81d5-b37c-000bcb1c1294",
  prospects: "2ffff160-df01-8195-9368-000b90930839",
} as const;

app.post("/imports/notion", requireRoles(["admin", "manager"]), async (context) => {
  const key = requireIdempotency(context);
  const input = z.object({
    unit_id: z.string().uuid(),
    dryRun: z.boolean().default(true),
  }).parse(await context.req.json());
  const db = context.get("db");
  const clinicId = context.get("profile").clinic_id;
  const { data: unit, error: unitError } = await db.from("units").select("id,name")
    .eq("id", input.unit_id).eq("clinic_id", clinicId).is("deleted_at", null).single();
  if (unitError || !unit) return fail(context, 404, "UNIT_NOT_FOUND", "A unidade de destino não foi encontrada.");

  const token = requiredEnv("NOTION_TOKEN");
  const inventories: Record<string, NotionPage[]> = {};
  for (const [entityType, sourceId] of Object.entries(notionSources)) {
    inventories[entityType] = await notionQueryAll(token, sourceId);
  }

  const issues = validateNotionInventory(inventories);
  const counts = Object.fromEntries(Object.entries(inventories).map(([name, rows]) => [name, rows.length]));
  if (input.dryRun) {
    await audit(context, "import.notion.validated", "import_batch", null, input.unit_id, {
      sourcePageId: "2ffff160-df01-81c0-b764-e4345252868f", counts, issueCount: issues.length,
    });
    return ok(context, { dryRun: true, unit, counts, issues, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  }

  const { data: batch, error: batchError } = await db.from("import_batches").insert({
    clinic_id: clinicId,
    source: "notion",
    filename: "[Oluma] Fisiofit Unidade I (API)",
    source_page_id: "2ffff160-df01-81c0-b764-e4345252868f",
    mapping: { unit_id: input.unit_id, unit_name: unit.name, sources: notionSources },
    status: "processing",
    stage: "extract",
    totals: { total: Object.values(counts).reduce((a, b) => a + b, 0), counts },
    errors: issues,
    idempotency_key: key,
    created_by: context.get("user").id,
  }).select().single();
  if (batchError || !batch) return databaseResult(context, null, batchError);

  const staged = Object.entries(inventories).flatMap(([entityType, pages]) => pages.map((page) => ({
    clinic_id: clinicId,
    batch_id: batch.id,
    source: "notion",
    entity_type: entityType,
    external_id: page.id,
    source_url: page.url,
    payload: notionPlainPage(page),
    status: "staged",
  })));
  const { error: stageError } = await db.from("migration_items").upsert(staged, {
    onConflict: "clinic_id,source,entity_type,external_id",
  });
  if (stageError) {
    await db.from("import_batches").update({ status: "failed", errors: [...issues, { reason: stageError.message }] }).eq("id", batch.id);
    return databaseResult(context, null, stageError);
  }

  const importResult = await importNotionCore(db, clinicId, input.unit_id, inventories);
  await db.from("import_batches").update({
    status: "completed",
    stage: "reconciled",
    totals: { total: staged.length, counts, ...importResult },
    errors: [...issues, ...importResult.pending],
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", batch.id);
  await audit(context, "import.notion.completed", "import_batch", batch.id, input.unit_id, {
    counts, imported: importResult.imported, pending: importResult.pending.length,
  });
  return ok(context, { batchId: batch.id, unit, counts, ...importResult }, 201);
});

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
    const unitId = context.req.query("unitId");
    if (unitId && ["rooms", "group_slots", "enrollments", "charges", "commissions", "financial_entries", "clinical_records"].includes(table)) {
      query = query.eq("unit_id", z.string().uuid().parse(unitId));
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

async function importNotionCore(db: any, clinicId: string, unitId: string, inventories: Record<string, NotionPage[]>) {
  const pending = validateNotionInventory(inventories);
  let professionalsImported = 0;
  let patientsImported = 0;

  const professionals = (inventories.professionals ?? []).flatMap((page) => {
    const name = notionTitle(page);
    if (name.length < 3) {
      pending.push({ entityType: "professionals", externalId: page.id, reason: "Fisioterapeuta sem nome válido" });
      return [];
    }
    return [{
      clinic_id: clinicId,
      name,
      council: notionText(page, "Número CREFITO") || null,
      active: notionText(page, "Situação") !== "Inativo",
      migration_source: "notion",
      external_id: page.id,
    }];
  });
  if (professionals.length) {
    const { data, error } = await db.from("professionals").upsert(professionals, {
      onConflict: "clinic_id,migration_source,external_id",
    }).select("id");
    if (error) throw error;
    professionalsImported = data?.length ?? 0;
  }

  const patients = (inventories.patients ?? []).flatMap((page) => {
    const name = notionTitle(page);
    if (name.length < 3) return [];
    const address = notionText(page, "Endereço");
    const notes = [
      notionText(page, "Gênero") ? `Gênero: ${notionText(page, "Gênero")}` : "",
      notionText(page, "Número Convênio") ? `Número do convênio: ${notionText(page, "Número Convênio")}` : "",
      notionText(page, "Status do Cliente") ? `Status original: ${notionText(page, "Status do Cliente")}` : "",
    ].filter(Boolean).join("\n");
    return [{
      clinic_id: clinicId,
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
    }];
  });
  if (patients.length) {
    const { data, error } = await db.from("patients").upsert(patients, {
      onConflict: "clinic_id,migration_source,external_id",
    }).select("id");
    if (error) throw error;
    patientsImported = data?.length ?? 0;
  }

  return {
    imported: { professionals: professionalsImported, patients: patientsImported },
    staged: Object.values(inventories).reduce((sum, rows) => sum + rows.length, 0),
    pending,
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
    "/privacy/requests": { get: { summary: "Lista solicitações de titulares" }, post: { summary: "Registra solicitação LGPD" } },
    "/privacy/incidents": { get: { summary: "Lista incidentes de privacidade" }, post: { summary: "Registra incidente" } },
    "/users/{id}": {
      patch: { summary: "Atualiza usuário, preservando a conta proprietária" },
      delete: { summary: "Arquiva usuário, bloqueia o acesso e preserva o histórico" },
    },
    "/users/{id}/resend-access": { post: { summary: "Reenvia um link seguro de definição de senha" } },
  },
};

Deno.serve(app.fetch);
