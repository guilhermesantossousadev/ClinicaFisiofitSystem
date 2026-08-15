import { z } from "npm:zod@3.24.2";

export function registerUsuariosRoutes(app: any, dependencies: any) {
  const { allowedOrigin, requireRoles, ok, fail, databaseResult, audit } = dependencies;
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
    const initialPermissions = defaultPermissionsForRole(input.role).map((permission) => ({
      profile_id: invited.user.id,
      module: permission.module,
      can_view: permission.canView,
      can_edit: permission.canEdit,
    }));
    if (initialPermissions.length) {
      const { error: permissionsError } = await context.get("db").from("profile_permissions").insert(initialPermissions);
      if (permissionsError) return databaseResult(context, null, permissionsError);
    }
    await audit(context, "user.invited", "profile", invited.user.id);
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
  
  app.get("/users", requireRoles(["admin", "manager"]), async (context: any) => {
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const [{ data, error }, { data: clinic, error: clinicError }, { data: authUsers, error: authError }] = await Promise.all([
      db.from("profiles")
      .select("id,name,role,status,mfa_required,created_at,profile_units(unit_id,units(id,name)),profile_permissions(module,can_view,can_edit)")
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
  
  app.patch("/users/:id", requireRoles(["admin"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      name: z.string().trim().min(3).max(120).optional(),
      role: z.enum(["admin", "manager", "reception", "professional", "finance"]).optional(),
      status: z.enum(["invited", "active", "blocked"]).optional(),
      unitIds: z.array(z.string().uuid()).optional(),
      permissions: z.record(z.object({ canView: z.boolean(), canEdit: z.boolean() })).optional(),
    }).parse(await context.req.json());
    const { unitIds, permissions, ...profileChanges } = input;
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
    if (permissions) {
      const modules = Object.entries(permissions).map(([module, value]) => ({
        profile_id: id, module, can_view: value.canView, can_edit: value.canEdit, updated_at: new Date().toISOString(),
      }));
      const { error: permissionError } = await db.from("profile_permissions").upsert(modules, { onConflict: "profile_id,module" });
      if (permissionError) return databaseResult(context, null, permissionError);
    }
    await audit(context, "user.updated", "profile", id);
    return ok(context, data);
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
