import { z } from "npm:zod@3.24.2";

export function registerPrivacidadeRoutes(app: any, dependencies: any) {
  const { requireRoles, databaseResult, audit, createClinicResource } = dependencies;
  app.post("/privacy/requests", requireRoles(["admin", "manager"]), async (context: any) => {
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
  
  app.patch("/privacy/requests/:id", requireRoles(["admin", "manager"]), async (context: any) => {
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
  
  app.post("/privacy/incidents", requireRoles(["admin"]), async (context: any) => {
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
}
