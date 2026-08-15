import { z } from "npm:zod@3.24.2";

export function registerPacientesRoutes(app: any, dependencies: any) {
  const { patientSchema, requireRoles, fail, databaseResult, hasUnitAccess, positiveInt, escapeLike, audit, createClinicResource } = dependencies;
  app.get("/patients", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
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
    if (unitId) {
      const parsedUnitId = z.string().uuid().parse(unitId);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("primary_unit_id", parsedUnitId);
    }
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.order("name").range(from, from + pageSize - 1);
    return databaseResult(context, { items: data ?? [], page, pageSize, total: count ?? 0 }, error);
  });
  
  app.get("/patients/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").from("patients").select("*")
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id)
      .is("deleted_at", null).single();
    if (!error && data) await audit(context, "patient.viewed", "patient", id, data.primary_unit_id);
    return databaseResult(context, data, error);
  });
  
  app.post("/patients", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const input = patientSchema.parse(await context.req.json());
    if (!(await hasUnitAccess(context, input.primary_unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await context.get("db").from("patients").insert({
      ...input,
      clinic_id: context.get("profile").clinic_id,
    }).select().single();
    if (!error && data) await audit(context, "patient.created", "patient", data.id, data.primary_unit_id);
    return databaseResult(context, data, error, 201);
  });
  
  app.patch("/patients/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = patientSchema.partial().extend({ active: z.boolean().optional() }).parse(await context.req.json());
    const { data: currentPatient } = await context.get("db").from("patients").select("primary_unit_id")
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).maybeSingle();
    if (!currentPatient || !(await hasUnitAccess(context, currentPatient.primary_unit_id))) {
      return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso à unidade atual deste paciente.");
    }
    if (input.primary_unit_id && !(await hasUnitAccess(context, input.primary_unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await context.get("db").from("patients").update({
      ...input,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null)
      .select().single();
    if (!error && data) await audit(context, "patient.updated", "patient", id, data.primary_unit_id);
    return databaseResult(context, data, error);
  });
  
  app.delete("/patients/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const { data: currentPatient } = await context.get("db").from("patients").select("primary_unit_id")
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).maybeSingle();
    if (!currentPatient || !(await hasUnitAccess(context, currentPatient.primary_unit_id))) {
      return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso à unidade deste paciente.");
    }
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
  
  app.get("/patients/:id/responsibles", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const patientId = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").from("responsibles").select("*")
      .eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", patientId)
      .is("deleted_at", null).order("name");
    return databaseResult(context, data, error);
  });
  
  app.post("/patients/:id/responsibles", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
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
  
  app.get("/patients/:id/consents", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const patientId = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").from("consents").select("*")
      .eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    return databaseResult(context, data, error);
  });
  
  app.post("/patients/:id/consents", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
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
  
  app.get("/patients/:id/timeline", requireRoles(["admin", "manager"]), async (context: any) => {
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
}
