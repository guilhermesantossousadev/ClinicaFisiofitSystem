import { z } from "npm:zod@3.24.2";

export function registerProntuariosRoutes(app: any, dependencies: any) {
  const { clinicalRecordSchema, requireRoles, fail, databaseResult, validateRelatedResourceScope, hasUnitAccess, audit, professionalForUser, isOwnProfessional, requireIdempotency } = dependencies;
  app.get("/clinical-records", requireRoles(["admin", "manager", "professional"]), async (context: any) => {
    const patientId = z.string().uuid().parse(context.req.query("patientId"));
    let query = context.get("db").from("clinical_records")
      .select("*").eq("clinic_id", context.get("profile").clinic_id)
      .eq("patient_id", patientId).is("deleted_at", null)
    if (context.get("profile").role === "professional") {
      const professionalId = await professionalForUser(context);
      if (!professionalId) return fail(context, 403, "PROFESSIONAL_NOT_LINKED", "Seu usuário não está vinculado a um profissional.");
      query = query.eq("professional_id", professionalId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) await audit(context, "clinical_records.viewed", "patient", patientId);
    return databaseResult(context, data, error);
  });
  
  app.get("/attachments", requireRoles(["admin", "manager", "professional", "reception"]), async (context: any) => {
    const patientId = z.string().uuid().parse(context.req.query("patientId"));
    const { data, error } = await context.get("db").from("attachments").select("id,patient_id,entity_type,entity_id,bucket,storage_path,filename,content_type,size_bytes,created_at")
      .eq("clinic_id", context.get("profile").clinic_id).eq("patient_id", patientId).is("deleted_at", null).order("created_at", { ascending: false });
    return databaseResult(context, data, error);
  });
  
  app.post("/attachments/upload-url", requireRoles(["admin", "manager", "professional", "reception"]), async (context: any) => {
    const input = z.object({
      patient_id: z.string().uuid(), entity_type: z.string().min(2).max(60), entity_id: z.string().uuid(),
      filename: z.string().trim().min(1).max(240), content_type: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), size_bytes: z.number().int().positive().max(26214400),
    }).parse(await context.req.json());
    const bucket = "clinical-files";
    const path = `${context.get("profile").clinic_id}/${input.patient_id}/${crypto.randomUUID()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data: signed, error: signedError } = await context.get("db").storage.from(bucket).createSignedUploadUrl(path);
    if (signedError || !signed) return databaseResult(context, null, signedError);
    const { data, error } = await context.get("db").from("attachments").insert({ ...input, clinic_id: context.get("profile").clinic_id, bucket, storage_path: path, uploaded_by: context.get("user").id }).select().single();
    return databaseResult(context, { attachment: data, token: signed.token, path }, error, 201);
  });
  
  app.delete("/attachments/:id", requireRoles(["admin", "manager", "professional", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const db = context.get("db");
    const { data: attachment, error: readError } = await db.from("attachments").select("id,bucket,storage_path").eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).single();
    if (readError || !attachment) return databaseResult(context, null, readError);
    await db.storage.from(attachment.bucket).remove([attachment.storage_path]);
    const { data, error } = await db.from("attachments").update({ deleted_at: new Date().toISOString() }).eq("id", id).select().single();
    return databaseResult(context, data, error);
  });
  
  app.post("/clinical-records", requireRoles(["admin", "manager", "professional"]), async (context: any) => {
    const input = clinicalRecordSchema.parse(await context.req.json());
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, input.professional_id))) return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode registrar em seu próprio prontuário profissional.");
    const { data, error } = await context.get("db").from("clinical_records").insert({
      ...input,
      clinic_id: context.get("profile").clinic_id,
      status: "draft",
    }).select().single();
    if (!error && data) await audit(context, "clinical_record.created", "clinical_record", data.id, data.unit_id);
    return databaseResult(context, data, error, 201);
  });
  
  app.post("/clinical-records/:id/sign", requireRoles(["admin", "manager", "professional"]), async (context: any) => {
    requireIdempotency(context);
    const id = z.string().uuid().parse(context.req.param("id"));
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: record, error: readError } = await db.from("clinical_records").select("*")
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "draft").single();
    if (readError || !record) return databaseResult(context, null, readError);
    if (!(await hasUnitAccess(context, record.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, record.professional_id))) return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode assinar seus próprios registros.");
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
  
  app.post("/clinical-records/:id/rectify", requireRoles(["admin", "manager", "professional"]), async (context: any) => {
    const originalId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      reason: z.string().trim().min(10).max(1000),
      payload: z.record(z.unknown()),
    }).parse(await context.req.json());
    const db = context.get("db");
    const { data: original, error: originalError } = await db.from("clinical_records").select("*")
      .eq("id", originalId).eq("clinic_id", context.get("profile").clinic_id).eq("status", "signed").single();
    if (originalError || !original) return databaseResult(context, null, originalError);
    if (!(await hasUnitAccess(context, original.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, original.professional_id))) return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode retificar seus próprios registros.");
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
}
