import { z } from "npm:zod@3.24.2";

export function registerAgendaRoutes(app: any, dependencies: any) {
  const { appointmentFields, appointmentSchema, requireRoles, ok, fail, databaseResult, hasUnitAccess, audit, professionalForUser, isOwnProfessional, getAuthorizedAppointment } = dependencies;
  app.get("/appointments", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const from = z.string().datetime({ offset: true }).parse(context.req.query("from"));
    const to = z.string().datetime({ offset: true }).parse(context.req.query("to"));
    const unit = context.req.query("unitId");
    const professional = context.req.query("professionalId");
    let query = context.get("db").from("appointments")
      .select("*,patients(id,name),professionals(id,name),services(id,name,color),rooms(id,name)")
      .eq("clinic_id", context.get("profile").clinic_id)
      .gte("starts_at", from).lt("starts_at", to).is("deleted_at", null);
    if (unit) {
      const parsedUnitId = z.string().uuid().parse(unit);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      query = query.eq("unit_id", parsedUnitId);
    }
    if (context.get("profile").role === "professional") {
      const ownProfessionalId = await professionalForUser(context);
      if (!ownProfessionalId) return fail(context, 403, "PROFESSIONAL_NOT_LINKED", "Seu usuário não está vinculado a um profissional.");
      if (professional && professional !== ownProfessionalId) return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode consultar sua própria agenda.");
      query = query.eq("professional_id", ownProfessionalId);
    } else if (professional) {
      query = query.eq("professional_id", z.string().uuid().parse(professional));
    }
    const { data, error } = await query.order("starts_at");
    return databaseResult(context, data, error);
  });
  
  app.post("/appointments", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const input = appointmentSchema.parse(await context.req.json());
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, input.professional_id))) {
      return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode criar agendamentos para si próprio.");
    }
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
  
  app.patch("/appointments/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = appointmentFields.extend({
      status: z.enum(["scheduled", "confirmed", "attending", "missed", "cancelled"]).optional(),
    }).refine((value) => value.ends_at > value.starts_at, {
      path: ["ends_at"],
      message: "O término deve ocorrer depois do início.",
    }).parse(await context.req.json());
    const currentAppointment = await getAuthorizedAppointment(context, id);
    if (currentAppointment instanceof Response) return currentAppointment;
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, input.professional_id))) {
      return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você não pode transferir o atendimento para outro profissional.");
    }
    const db = context.get("db");
    const { data: conflict, error: conflictError } = await db.rpc("check_appointment_conflict", {
      p_unit_id: input.unit_id, p_professional_id: input.professional_id, p_room_id: input.room_id ?? null,
      p_starts_at: input.starts_at, p_ends_at: input.ends_at, p_exclude_id: id, p_group_slot_id: input.group_slot_id ?? null,
    });
    if (conflictError) return databaseResult(context, null, conflictError);
    if (conflict?.conflict) return fail(context, 409, "SCHEDULE_CONFLICT", "Profissional ou sala já possui compromisso nesse horário.");
    const { data, error } = await db.from("appointments").update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select().single();
    if (!error && data) await audit(context, "appointment.updated", "appointment", id, data.unit_id);
    return databaseResult(context, data, error);
  });
  
  app.delete("/appointments/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const currentAppointment = await getAuthorizedAppointment(context, id);
    if (currentAppointment instanceof Response) return currentAppointment;
    const deletedAt = new Date().toISOString();
    const { data, error } = await context.get("db").from("appointments").update({ status: "cancelled", deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select("id,unit_id").single();
    if (!error && data) await audit(context, "appointment.deleted", "appointment", id, data.unit_id);
    return databaseResult(context, data, error);
  });
  
  app.patch("/appointments/:id/status", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const currentAppointment = await getAuthorizedAppointment(context, id);
    if (currentAppointment instanceof Response) return currentAppointment;
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
  
  app.post("/group-slots", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    return fail(context, 405, "FIXED_SCHEDULE", "Os horários são fixos e não podem ser cadastrados. Altere apenas os alunos da turma.");
  /*
    const input = z.object({
      unit_id: z.string().uuid(),
      room_id: z.string().uuid(),
      professional_id: z.string().uuid(),
      service_id: z.string().uuid(),
      name: z.string().trim().min(3).max(100),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      starts_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      starts_on: z.string().date().optional(),
      ends_on: z.string().date().optional(),
      duration_minutes: z.number().int().min(15).max(240),
      capacity: z.number().int().min(3).max(7).default(7),
    }).refine((value) => !value.ends_on || Boolean(value.starts_on && value.ends_on >= value.starts_on), {
      message: "A data final da turma não pode ser anterior à data inicial.",
      path: ["ends_on"],
    }).parse(await context.req.json());
    if (!(await hasUnitAccess(context, input.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const db = context.get("db");
    const normalizedWeekdays = [...new Set(input.weekdays)].sort();
    const { data: conflictingSlots } = await db.from("group_slots").select("id,name,weekdays,starts_at")
      .eq("clinic_id", context.get("profile").clinic_id).eq("unit_id", input.unit_id).eq("starts_at", input.starts_at).eq("active", true).is("deleted_at", null);
    if ((conflictingSlots ?? []).some((slot: any) => (slot.weekdays ?? []).some((day: number) => normalizedWeekdays.includes(day)))) {
      return fail(context, 409, "GROUP_SLOT_CONFLICT", "Já existe uma turma nesta unidade para o mesmo dia e horário. Escolha outro horário ou dia.");
    }
    const { data, error } = await db.from("group_slots").insert({
      ...input,
      weekdays: normalizedWeekdays,
      clinic_id: context.get("profile").clinic_id,
    }).select().single();
    if (!error && data) {
      await generateGroupAppointments(context, data.id, new Date().toISOString().slice(0, 10), addDays(new Date(), 90));
      await audit(context, "group_slot.created", "group_slot", data.id, data.unit_id);
    }
    return databaseResult(context, data, error, 201);
  });
  */
  
  });
  
  function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
  }
  
  async function generateGroupAppointments(context: any, groupSlotId: string, from: string, to: string) {
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots")
      .select("id,clinic_id,unit_id,room_id,professional_id,service_id,weekdays,starts_at,starts_on,ends_on,duration_minutes,active")
      .eq("id", groupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot || !slot.active) return { created: 0, error: slotError };
    const effectiveFrom = slot.starts_on && slot.starts_on > from ? slot.starts_on : from;
    const effectiveTo = slot.ends_on && slot.ends_on < to ? slot.ends_on : to;
    if (effectiveTo < effectiveFrom) return { created: 0 };
    const { data: existing } = await db.from("appointments").select("starts_at")
      .eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).gte("starts_at", `${effectiveFrom}T00:00:00Z`).lt("starts_at", `${addDays(new Date(`${effectiveTo}T00:00:00Z`), 1)}T00:00:00Z`).is("deleted_at", null);
    const known = new Set((existing ?? []).map((row: any) => new Date(row.starts_at).toISOString().slice(0, 16)));
    const rows: any[] = [];
    for (let cursor = new Date(`${effectiveFrom}T00:00:00Z`); cursor <= new Date(`${effectiveTo}T00:00:00Z`); cursor = new Date(cursor.getTime() + 86400000)) {
      if (!slot.weekdays.includes(cursor.getUTCDay())) continue;
      const [hours, minutes] = String(slot.starts_at).slice(0, 5).split(":").map(Number);
      const starts = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), hours, minutes));
      const ends = new Date(starts.getTime() + slot.duration_minutes * 60000);
      const key = starts.toISOString().slice(0, 16);
      if (known.has(key)) continue;
      rows.push({ clinic_id: clinicId, unit_id: slot.unit_id, room_id: slot.room_id, professional_id: slot.professional_id, service_id: slot.service_id, group_slot_id: slot.id, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: "scheduled" });
    }
    if (!rows.length) return { created: 0 };
    const { error } = await db.from("appointments").insert(rows);
    return { created: error ? 0 : rows.length, error };
  }
  
  app.post("/group-slots/:id/generate", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    return fail(context, 405, "FIXED_SCHEDULE", "Os horários fixos não precisam ser gerados.");
  /*
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ from: z.string().date(), to: z.string().date() }).parse(await context.req.json());
    if (input.to < input.from) return fail(context, 400, "INVALID_RANGE", "A data final deve ser posterior à inicial.");
    const result = await generateGroupAppointments(context, id, input.from, input.to);
    if (result.error) return databaseResult(context, null, result.error);
    return context.json({ data: { created: result.created } });
  });
  */
  
  });
  
  app.patch("/group-slots/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ professional_id: z.string().uuid() }).strict().parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id")
      .eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle();
    if (slotError) return databaseResult(context, null, slotError);
    if (!slot) return fail(context, 404, "GROUP_SLOT_NOT_FOUND", "Horário não encontrado.");
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");

    const [{ data: professional, error: professionalError }, { data: professionalUnit, error: professionalUnitError }] = await Promise.all([
      db.from("professionals").select("id").eq("id", input.professional_id).eq("clinic_id", clinicId).eq("active", true).is("deleted_at", null).maybeSingle(),
      db.from("professional_units").select("professional_id").eq("professional_id", input.professional_id).eq("unit_id", slot.unit_id).maybeSingle(),
    ]);
    if (professionalError || professionalUnitError) return fail(context, 400, "PROFESSIONAL_VALIDATION_FAILED", "Não foi possível validar o fisioterapeuta selecionado.");
    if (!professional || !professionalUnit) return fail(context, 400, "INVALID_PROFESSIONAL_SCOPE", "O fisioterapeuta não está ativo nesta unidade.");

    const { data, error } = await db.from("group_slots").update({
      professional_id: input.professional_id,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).select().single();
    if (!error && data) await audit(context, "group_slot.professional_updated", "group_slot", id, slot.unit_id, { professionalId: input.professional_id });
    return databaseResult(context, data, error);
  });
  
  app.delete("/group-slots/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    return fail(context, 405, "FIXED_SCHEDULE", "Os horários e turmas são fixos e não podem ser excluídos.");
  /*
    const id = z.string().uuid().parse(context.req.param("id"));
    const deletedAt = new Date().toISOString();
    const { data, error } = await context.get("db").from("group_slots").update({ active: false, deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select("id,unit_id").single();
    if (!error && data) await audit(context, "group_slot.deleted", "group_slot", id, data.unit_id);
    return databaseResult(context, data, error);
  });
  */
  
  });
  
  app.post("/group-slots/:id/members", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const groupSlotId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      enrollment_id: z.string().uuid(),
      patient_id: z.string().uuid(),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(3).transform((days) => [...new Set(days)].sort()),
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,capacity,weekdays")
      .eq("id", groupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot) return databaseResult(context, null, slotError);
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data: enrollment } = await db.from("enrollments").select("id,patient_id,unit_id,status,starts_at,ends_at")
      .eq("id", input.enrollment_id).eq("clinic_id", clinicId).eq("patient_id", input.patient_id).eq("unit_id", slot.unit_id).eq("status", "active").is("deleted_at", null).maybeSingle();
    if (!enrollment) return fail(context, 400, "INVALID_ENROLLMENT", "A matrícula não corresponde ao paciente e à unidade desta turma.");
    if (input.ends_at && input.ends_at < input.starts_at) return fail(context, 400, "INVALID_PERIOD", "A data final não pode ser anterior à inicial.");
    if (input.weekdays.some((day) => !(slot.weekdays ?? []).includes(day))) return fail(context, 400, "INVALID_WEEKDAYS", "Selecione apenas dias disponíveis neste horário fixo.");
    const { data: existingMembership } = await db.from("group_slot_memberships").select("id").eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("patient_id", input.patient_id).eq("status", "active").is("deleted_at", null).maybeSingle();
    if (existingMembership) return ok(context, existingMembership);
    const { data: activeMemberships, error: countError } = await db.from("group_slot_memberships").select("weekdays")
      .eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("status", "active").is("deleted_at", null);
    if (countError) return databaseResult(context, null, countError);
    if (input.weekdays.some((day) => (activeMemberships ?? []).filter((membership: any) => membership.weekdays?.includes(day)).length >= slot.capacity)) {
      return fail(context, 409, "GROUP_CAPACITY_REACHED", "Um dos dias selecionados já atingiu a capacidade deste horário.");
    }
    const { data, error } = await db.from("group_slot_memberships").insert({
      ...input,
      group_slot_id: groupSlotId,
      clinic_id: context.get("profile").clinic_id,
    }).select().single();
    if (!error && data) await audit(context, "group_slot.member_added", "group_slot_membership", data.id, slot.unit_id);
    return databaseResult(context, data, error, 201);
  });
  
  app.delete("/group-slot-memberships/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const deletedAt = new Date().toISOString();
    const { data, error } = await context.get("db").from("group_slot_memberships")
      .update({ status: "cancelled", deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", id).eq("clinic_id", context.get("profile").clinic_id).is("deleted_at", null).select("id").single();
    if (!error && data) await audit(context, "group_slot.member_removed", "group_slot_membership", id);
    return databaseResult(context, data, error);
  });
  
  app.patch("/group-slot-memberships/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(3).transform((days) => [...new Set(days)].sort()),
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
    }).refine((value) => !value.ends_at || value.ends_at >= value.starts_at, {
      message: "A data final não pode ser anterior à inicial.",
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: current, error: currentError } = await db.from("group_slot_memberships")
      .select("id,group_slot_id")
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).single();
    if (currentError || !current) return databaseResult(context, null, currentError);
    const { data: slot, error: slotError } = await db.from("group_slots").select("weekdays,capacity")
      .eq("id", current.group_slot_id).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot) return databaseResult(context, null, slotError);
    if (input.weekdays.some((day) => !(slot.weekdays ?? []).includes(day))) return fail(context, 400, "INVALID_WEEKDAYS", "Selecione apenas dias disponíveis neste horário fixo.");
    const { data: otherMemberships, error: countError } = await db.from("group_slot_memberships").select("weekdays")
      .eq("clinic_id", clinicId).eq("group_slot_id", current.group_slot_id).eq("status", "active").is("deleted_at", null).neq("id", id);
    if (countError) return databaseResult(context, null, countError);
    if (input.weekdays.some((day) => (otherMemberships ?? []).filter((membership: any) => membership.weekdays?.includes(day)).length >= slot.capacity)) {
      return fail(context, 409, "GROUP_CAPACITY_REACHED", "Um dos dias selecionados já atingiu a capacidade deste horário.");
    }
    const { data, error } = await db.from("group_slot_memberships")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).select("id,group_slot_id,weekdays,starts_at,ends_at").single();
    if (!error && data) await audit(context, "group_slot.member_updated", "group_slot_membership", id);
    return databaseResult(context, data, error);
  });
  
  app.post("/appointments/:id/complete", requireRoles(["admin", "manager", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const currentAppointment = await getAuthorizedAppointment(context, id);
    if (currentAppointment instanceof Response) return currentAppointment;
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, currentAppointment.professional_id))) {
      return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode concluir seus próprios atendimentos.");
    }
    const { data, error } = await context.get("db").rpc("complete_appointment", {
      p_appointment_id: id,
      p_request_id: context.get("requestId"),
    });
    return databaseResult(context, data, error);
  });
}
