import { z } from "npm:zod@3.24.2";

export function registerFinanceiroRoutes(app: any, dependencies: any) {
  const { financialEntrySchema, requireRoles, fail, databaseResult, hasUnitAccess, audit, createClinicResource, requireIdempotency, normalizeAnnual, listResource } = dependencies;
  app.post("/payments", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
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
  
  app.post("/payments/:id/reverse", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("reverse_payment", { p_payment_id: id, p_reason: input.reason, p_request_id: context.get("requestId") });
    return databaseResult(context, data, error);
  });
  
  app.get("/financial-entries", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const from = z.string().date().parse(context.req.query("from"));
    const to = z.string().date().parse(context.req.query("to"));
    const unit = context.req.query("unitId");
    let query = context.get("db").from("financial_entries").select("*")
      .eq("clinic_id", context.get("profile").clinic_id)
      .gte("competence_date", from).lte("competence_date", to).is("deleted_at", null);
    if (unit) {
      const parsedUnitId = z.string().uuid().parse(unit);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("unit_id", parsedUnitId);
    }
    const { data, error } = await query.order("competence_date", { ascending: false });
    return databaseResult(context, data, error);
  });
  
  app.post("/financial-entries", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const input = financialEntrySchema.parse(await context.req.json());
    if (!(await hasUnitAccess(context, input.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await context.get("db").from("financial_entries").insert({
      ...input,
      clinic_id: context.get("profile").clinic_id,
    }).select().single();
    if (!error && data) await audit(context, "financial_entry.created", "financial_entry", data.id, data.unit_id);
    return databaseResult(context, data, error, 201);
  });
  
  app.patch("/financial-entries/:id", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = financialEntrySchema.partial().parse(await context.req.json());
    if (input.unit_id && !(await hasUnitAccess(context, input.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await context.get("db").from("financial_entries").update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select().single();
    if (!error && data) await audit(context, "financial_entry.updated", "financial_entry", id, data.unit_id);
    return databaseResult(context, data, error);
  });
  
  app.delete("/financial-entries/:id", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const db = context.get("db");
    const { data: current, error: readError } = await db.from("financial_entries").select("unit_id").eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).single();
    if (readError || !current) return databaseResult(context, null, readError);
    if (!(await hasUnitAccess(context, current.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await db.from("financial_entries").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (!error) await audit(context, "financial_entry.deleted", "financial_entry", id, current.unit_id);
    return databaseResult(context, data, error);
  });
  
  app.post("/commissions", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const input = z.object({
      unit_id: z.string().uuid(),
      professional_id: z.string().uuid(),
      appointment_id: z.string().uuid().optional(),
      payment_id: z.string().uuid().optional(),
      amount_cents: z.number().int().nonnegative(),
      basis: z.enum(["appointment", "payment"]),
    }).parse(await context.req.json());
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;
    return createClinicResource(context, "commissions", { ...input, status: "pending" }, "commission.created", input.unit_id);
  });
  
  app.post("/commissions/:id/approve", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").rpc("approve_commission", {
      p_commission_id: id,
      p_request_id: context.get("requestId"),
    });
    return databaseResult(context, data, error);
  });
  
  app.get("/closings", requireRoles(["admin", "manager", "finance"]), listResource("monthly_closings", "reference_month", false));
  
  app.post("/closings", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const input = z.object({
      unit_id: z.string().uuid().optional(),
      reference_month: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(await context.req.json());
    if (input.unit_id && !(await hasUnitAccess(context, input.unit_id))) {
      return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    }
    if (!input.unit_id && context.get("profile").role !== "admin") {
      return fail(context, 403, "UNIT_REQUIRED", "Selecione uma unidade para realizar o fechamento.");
    }
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
  
  app.post("/closings/:id/reopen", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(await context.req.json());
    const db = context.get("db");
    const { data: current, error: readError } = await db.from("monthly_closings").select("id,unit_id,status").eq("id", id).eq("clinic_id", context.get("profile").clinic_id).single();
    if (readError || !current) return databaseResult(context, null, readError);
    if (current.unit_id && !(await hasUnitAccess(context, current.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    if (current.status !== "closed") return fail(context, 409, "CLOSING_NOT_CLOSED", "Este fechamento já está reaberto.");
    const { data, error } = await db.from("monthly_closings").update({ status: "reopened", reopening_reason: input.reason }).eq("id", id).select().single();
    if (!error) await audit(context, "closing.reopened", "monthly_closing", id, current.unit_id, { reason: input.reason });
    return databaseResult(context, data, error);
  });
  
  app.get("/reports/annual", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const year = z.coerce.number().int().min(2020).max(2100).parse(context.req.query("year"));
    const unit = context.req.query("unitId");
    let query = context.get("db").from("monthly_financial_summary").select("*")
      .gte("month", `${year}-01-01`).lte("month", `${year}-12-31`);
    if (unit) {
      const parsedUnitId = z.string().uuid().parse(unit);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("unit_id", parsedUnitId);
    }
    const { data, error } = await query.order("month");
    if (!error) await audit(context, "report.annual.viewed", "report", null, unit);
    return databaseResult(context, normalizeAnnual(data ?? [], year), error);
  });
  
  app.get("/reports/monthly", requireRoles(["admin", "manager", "finance"]), async (context: any) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).parse(context.req.query("month"));
    const unit = context.req.query("unitId");
    let query = context.get("db").from("monthly_financial_summary").select("*").eq("month", `${month}-01`);
    if (unit) {
      const parsedUnitId = z.string().uuid().parse(unit);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("unit_id", parsedUnitId);
    }
    const { data, error } = await query;
    return databaseResult(context, data, error);
  });
}
