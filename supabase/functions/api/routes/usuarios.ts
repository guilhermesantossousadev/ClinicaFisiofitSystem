import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3.24.2";
import { defaultPermissionsForRole } from "../authorization.ts";

export function registerUsuariosRoutes(app: any, dependencies: any) {
  const { allowedOrigin, requireRoles, ok, fail, databaseResult, audit, requiredEnv } = dependencies;
  app.post("/users/invite", requireRoles(["admin"]), async (context: any) => {
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
    const permissions = Object.fromEntries(defaultPermissionsForRole(input.role).map((p) => [p.module, { canView: p.canView, canEdit: p.canEdit }]));
    const { error: profileError } = await context.get("db").rpc("save_clinic_user", { p_id: invited.user.id, p_create: true, p_input: { name: input.name, role: input.role, unitIds: input.unitIds, permissions } });
    if (profileError) return fail(context, 409, "INVITATION_MEMBERSHIP_INCOMPLETE", "A conta foi convidada, mas o acesso à clínica não foi salvo. Solicite a conclusão do convite à administração.");
    return ok(context, { id: invited.user.id, email: input.email, status: "invited" }, 201);
  });
  
  app.post("/users/:id/resend-access", requireRoles(["admin"]), async (context: any) => {
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

  app.post("/users/:id/password", requireRoles(["admin"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      password: z.string().min(10).max(72),
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: target, error: targetError } = await db.from("profiles")
      .select("id,status")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetError) return databaseResult(context, null, targetError);
    if (!target) {
      return fail(context, 404, "USER_NOT_FOUND", "Usuária não encontrada nesta clínica.");
    }
    if (target.status === "blocked") {
      return fail(context, 409, "MEMBERSHIP_BLOCKED", "Ative a conta antes de definir uma nova senha.");
    }

    const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: updated, error: passwordError } = await admin.auth.admin.updateUserById(id, {
      password: input.password,
    });
    if (passwordError || !updated.user) {
      console.error(JSON.stringify({
        requestId: context.get("requestId"),
        code: passwordError?.code,
        message: passwordError?.message,
      }));
      const weakPassword = passwordError?.code === "weak_password";
      return fail(
        context,
        400,
        weakPassword ? "WEAK_PASSWORD" : "PASSWORD_UPDATE_FAILED",
        weakPassword
          ? "A senha foi recusada pela política de segurança do Supabase. Use uma senha mais forte."
          : "Não foi possível definir a senha no Supabase.",
      );
    }

    if (target.status === "invited") {
      const { error: activationError } = await db.from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("clinic_id", clinicId);
      if (activationError) return databaseResult(context, null, activationError);
    }
    await audit(context, "user.password_changed", "profile", id, null, {
      targetIsCurrentUser: id === context.get("user").id,
    });
    return ok(context, {
      id,
      email: updated.user.email ?? "",
      status: target.status === "invited" ? "active" : target.status,
    });
  });
  
  app.get("/users", requireRoles(["admin", "manager"]), async (context: any) => {
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const [{ data, error }, { data: clinic, error: clinicError }] = await Promise.all([
      db.from("profiles")
      .select("id,name,role,status,created_at,profile_units(unit_id,units(id,name)),profile_permissions(module,can_view,can_edit)")
      .eq("clinic_id", clinicId).is("deleted_at", null).order("name"),
      db.from("clinics").select("owner_profile_id").eq("id", clinicId).single(),
    ]);
    if (error || clinicError) return databaseResult(context, null, error ?? clinicError);
    const emails = new Map<string, string>();
    for (const profile of data ?? []) { const result = await admin.auth.admin.getUserById(profile.id); if (result.error) return databaseResult(context, null, result.error); emails.set(profile.id, result.data.user?.email ?? ""); }
    return databaseResult(context, (data ?? []).map((profile: any) => ({
      ...profile,
      email: emails.get(profile.id) ?? "",
      is_owner: profile.id === clinic?.owner_profile_id,
    })), error ?? clinicError);
  });
  
  app.patch("/users/:id", requireRoles(["admin"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      name: z.string().trim().min(3).max(120).optional(),
      role: z.enum(["admin", "manager", "reception", "professional", "finance"]).optional(),
      status: z.enum(["invited", "active", "blocked"]).optional(),
      unitIds: z.array(z.string().uuid()).optional(),
      permissions: z.record(z.object({ canView: z.boolean(), canEdit: z.boolean() })).optional(),
    }).parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("save_clinic_user", { p_id: id, p_input: input });
    return databaseResult(context, data, error);
  });
  
  app.delete("/users/:id", requireRoles(["admin"]), async (context: any) => {
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
}
