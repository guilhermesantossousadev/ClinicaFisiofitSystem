import { z } from "npm:zod@3.24.2";

export function registerAgendaRoutes(app: any, dependencies: any) {
  const { appointmentFields, appointmentSchema, requireRoles, ok, fail, databaseResult, validateRelatedResourceScope, hasUnitAccess, audit, professionalForUser, isOwnProfessional, getAuthorizedAppointment } = dependencies;
  async function validateActiveProfessional(context: any, professionalId: string, unitId: string) {
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const [{ data: professional, error: professionalError }, { data: professionalUnit, error: professionalUnitError }] = await Promise.all([
      db.from("professionals").select("id").eq("id", professionalId).eq("clinic_id", clinicId).eq("active", true).is("deleted_at", null).maybeSingle(),
      db.from("professional_units").select("professional_id").eq("professional_id", professionalId).eq("unit_id", unitId).maybeSingle(),
    ]);
    if (professionalError || professionalUnitError) return fail(context, 400, "PROFESSIONAL_VALIDATION_FAILED", "Não foi possível validar o fisioterapeuta selecionado.");
    if (!professional) return fail(context, 400, "PROFESSIONAL_INACTIVE", "O fisioterapeuta selecionado está inativo ou não existe.");
    if (!professionalUnit) return fail(context, 400, "PROFESSIONAL_UNIT_NOT_LINKED", "O fisioterapeuta não está vinculado a esta unidade. Atualize as unidades do profissional em Configurações.");
    return null;
  }

  function groupPeriodsOverlap(first: { starts_on?: string | null; ends_on?: string | null }, second: { starts_on?: string | null; ends_on?: string | null }) {
    const firstStart = first.starts_on ?? "0000-01-01";
    const firstEnd = first.ends_on ?? "9999-12-31";
    const secondStart = second.starts_on ?? "0000-01-01";
    const secondEnd = second.ends_on ?? "9999-12-31";
    return firstStart <= secondEnd && secondStart <= firstEnd;
  }

  function groupScheduleChanged(current: any, target: any) {
    const currentWeekdays = [...(current.weekdays ?? [])].sort((a: number, b: number) => a - b);
    const targetWeekdays = [...(target.weekdays ?? [])].sort((a: number, b: number) => a - b);
    return String(current.starts_at).slice(0, 5) !== String(target.starts_at).slice(0, 5)
      || currentWeekdays.join(",") !== targetWeekdays.join(",")
      || (current.starts_on ?? null) !== (target.starts_on ?? null)
      || (current.ends_on ?? null) !== (target.ends_on ?? null)
      || (!current.active && target.active);
  }
  app.get("/attendance/daily", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const classDate = z.string().date().parse(context.req.query("date"));
    const weekday = new Date(`${classDate}T12:00:00Z`).getUTCDay();
    const unitId = context.req.query("unitId");
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    let slotsQuery = db.from("group_slots")
      .select("id,unit_id,professional_id,service_id,room_id,name,starts_at,duration_minutes,capacity,units(name),professionals(name),services(name),rooms(name)")
      .eq("clinic_id", clinicId).eq("active", true).contains("weekdays", [weekday]).is("deleted_at", null)
      .or(`starts_on.is.null,starts_on.lte.${classDate}`).or(`ends_on.is.null,ends_on.gte.${classDate}`);
    if (unitId) {
      const parsedUnitId = z.string().uuid().parse(unitId);
      if (!(await hasUnitAccess(context, parsedUnitId))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
      slotsQuery = slotsQuery.eq("unit_id", parsedUnitId);
    }
    if (context.get("profile").role === "professional") {
      const professionalId = await professionalForUser(context);
      if (!professionalId) return fail(context, 403, "PROFESSIONAL_NOT_LINKED", "Seu usuário não está vinculado a um profissional.");
      slotsQuery = slotsQuery.eq("professional_id", professionalId);
    }
    const { data: slots, error: slotsError } = await slotsQuery.order("starts_at");
    if (slotsError) return databaseResult(context, null, slotsError);
    const slotIds = (slots ?? []).map((slot: any) => slot.id);
    if (!slotIds.length) {
      let pendingQuery = db.from("class_attendances")
        .select("id,class_date,patient_id,group_slot_id,makeup_status,patients(name),group_slots(name,starts_at)")
        .eq("clinic_id", clinicId).eq("status", "absent").eq("makeup_status", "pending")
        .order("class_date", { ascending: true }).limit(500);
      if (unitId) pendingQuery = pendingQuery.eq("unit_id", unitId);
      const { data: makeups, error: makeupsError } = await pendingQuery;
      return makeupsError ? databaseResult(context, null, makeupsError) : ok(context, { slots: [], makeups: makeups ?? [] });
    }
    let makeupsQuery = db.from("class_attendances")
      .select("id,class_date,patient_id,group_slot_id,makeup_status,patients(name),group_slots(name,starts_at)")
      .eq("clinic_id", clinicId).eq("status", "absent").eq("makeup_status", "pending")
      .order("class_date", { ascending: true }).limit(500);
    if (unitId) makeupsQuery = makeupsQuery.eq("unit_id", unitId);
    const [{ data: memberships, error: membershipsError }, { data: attendances, error: attendanceError }, { data: makeups, error: makeupsError }] = await Promise.all([
      db.from("group_slot_memberships")
        .select("id,group_slot_id,enrollment_id,patient_id,patients(name,phone)")
        .eq("clinic_id", clinicId).in("group_slot_id", slotIds).eq("status", "active")
        .lte("starts_at", classDate).or(`ends_at.is.null,ends_at.gte.${classDate}`).is("deleted_at", null).order("created_at"),
      db.from("class_attendances").select("id,membership_id,status,makeup_status,updated_at")
        .eq("clinic_id", clinicId).eq("class_date", classDate).in("group_slot_id", slotIds),
      makeupsQuery,
    ]);
    const error = membershipsError ?? attendanceError ?? makeupsError;
    if (error) return databaseResult(context, null, error);
    const attendanceByMembership = new Map((attendances ?? []).map((item: any) => [item.membership_id, item]));
    return ok(context, {
      slots: (slots ?? []).map((slot: any) => ({
        ...slot,
        members: (memberships ?? []).filter((member: any) => member.group_slot_id === slot.id).map((member: any) => ({
          ...member,
          attendance: attendanceByMembership.get(member.id) ?? null,
        })),
      })),
      makeups: makeups ?? [],
    });
  });

  app.post("/attendance", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const input = z.object({
      membership_id: z.string().uuid(),
      class_date: z.string().date(),
      status: z.enum(["present", "absent"]),
    }).parse(await context.req.json());
    const weekday = new Date(`${input.class_date}T12:00:00Z`).getUTCDay();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    if (input.class_date > today) return fail(context, 422, "FUTURE_ATTENDANCE", "A chamada só pode ser registrada no dia da aula ou depois dela.");
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: membership, error: membershipError } = await db.from("group_slot_memberships")
      .select("id,group_slot_id,enrollment_id,patient_id,weekdays,starts_at,ends_at,group_slots(unit_id,professional_id,weekdays,starts_on,ends_on)")
      .eq("id", input.membership_id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).single();
    if (membershipError || !membership) return databaseResult(context, null, membershipError);
    const slot = Array.isArray(membership.group_slots) ? membership.group_slots[0] : membership.group_slots;
    const validDate = slot?.weekdays?.includes(weekday)
      && input.class_date >= membership.starts_at && (!membership.ends_at || input.class_date <= membership.ends_at)
      && (!slot.starts_on || input.class_date >= slot.starts_on) && (!slot.ends_on || input.class_date <= slot.ends_on);
    if (!validDate) return fail(context, 422, "INVALID_CLASS_DATE", "O paciente não pertence a este horário na data selecionada.");
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    if (context.get("profile").role === "professional" && !(await isOwnProfessional(context, slot.professional_id))) {
      return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode registrar a chamada das suas próprias turmas.");
    }
    const payload = {
      clinic_id: clinicId,
      unit_id: slot.unit_id,
      group_slot_id: membership.group_slot_id,
      membership_id: membership.id,
      enrollment_id: membership.enrollment_id,
      patient_id: membership.patient_id,
      class_date: input.class_date,
      status: input.status,
      makeup_status: input.status === "absent" ? "pending" : "not_required",
      makeup_completed_at: null,
      recorded_by: context.get("user").id,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await db.from("class_attendances").upsert(payload, { onConflict: "membership_id,class_date" }).select().single();
    if (!error && data) await audit(context, `attendance.${input.status}`, "class_attendance", data.id, slot.unit_id, { classDate: input.class_date, patientId: membership.patient_id });
    return databaseResult(context, data, error);
  });

  app.patch("/attendance/:id/makeup", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ status: z.enum(["completed", "waived"]) }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: current, error: currentError } = await db.from("class_attendances").select("id,unit_id,group_slot_id")
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "absent").eq("makeup_status", "pending").single();
    if (currentError || !current) return databaseResult(context, null, currentError);
    if (!(await hasUnitAccess(context, current.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data, error } = await db.from("class_attendances").update({
      makeup_status: input.status,
      makeup_completed_at: input.status === "completed" ? new Date().toISOString() : null,
      recorded_by: context.get("user").id,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("clinic_id", clinicId).select().single();
    if (!error && data) await audit(context, `attendance.makeup_${input.status}`, "class_attendance", id, current.unit_id);
    return databaseResult(context, data, error);
  });
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
    const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
    if (professionalError) return professionalError;
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
      status: input.patient_id ? "scheduled" : "blocked",
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
    const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
    if (professionalError) return professionalError;
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
    const nextStatus = input.patient_id
      ? (currentAppointment.status === "blocked" && !input.status ? "scheduled" : input.status)
      : (input.status === "cancelled" ? "cancelled" : "blocked");
    const { data, error } = await db.from("appointments").update({ ...input, ...(nextStatus ? { status: nextStatus } : {}), updated_at: new Date().toISOString() })
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
    const input = z.object({
      unit_id: z.string().uuid(),
      room_id: z.string().uuid().optional(),
      professional_id: z.string().uuid(),
      service_id: z.string().uuid().optional(),
      name: z.string().trim().min(3).max(100),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(5),
      starts_at: z.string().regex(/^(0[6-9]|1\d|20):00(?::00)?$/, "Selecione um dos horários fixos entre 06:00 e 20:00."),
      starts_on: z.string().date().optional(),
      ends_on: z.string().date().optional(),
      duration_minutes: z.number().int().min(15).max(240),
      capacity: z.number().int().min(3).max(7).default(7),
    }).refine((value) => !value.ends_on || Boolean(value.starts_on && value.ends_on >= value.starts_on), {
      message: "A data final da turma não pode ser anterior à data inicial.",
      path: ["ends_on"],
    }).parse(await context.req.json());
    const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
    if (professionalError) return professionalError;
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;
    const db = context.get("db");
    const normalizedWeekdays = [...new Set(input.weekdays)].sort();
    const { data: conflictingSlots, error: conflictError } = await db.from("group_slots").select("id,name,weekdays,starts_at,starts_on,ends_on")
      .eq("clinic_id", context.get("profile").clinic_id).eq("unit_id", input.unit_id).eq("starts_at", input.starts_at).eq("active", true).is("deleted_at", null);
    if (conflictError) return databaseResult(context, null, conflictError);
    const conflictingGroup = (conflictingSlots ?? []).find((slot: any) => groupPeriodsOverlap(slot, input) && (slot.weekdays ?? []).some((day: number) => normalizedWeekdays.includes(day)));
    if (conflictingGroup) {
      return fail(context, 409, "GROUP_SLOT_CONFLICT", "Já existe outra turma nesta unidade para o mesmo dia e horário.", {
        conflictingGroup: {
          id: conflictingGroup.id,
          name: conflictingGroup.name,
          weekdays: conflictingGroup.weekdays,
          startsAt: String(conflictingGroup.starts_at).slice(0, 5),
          startsOn: conflictingGroup.starts_on,
          endsOn: conflictingGroup.ends_on,
        },
      });
    }
    const { data, error } = await db.from("group_slots").insert({
      ...input,
      weekdays: normalizedWeekdays,
      clinic_id: context.get("profile").clinic_id,
    }).select().single();
    if (!error && data) {
      await audit(context, "group_slot.created", "group_slot", data.id, data.unit_id);
    }
    return databaseResult(context, data, error, 201);
  });

  app.post("/group-slots/bulk", requireRoles(["admin"]), async (context: any) => {
    const input = z.object({
      unit_id: z.string().uuid(),
      room_id: z.string().uuid().optional(),
      professional_id: z.string().uuid(),
      service_id: z.string().uuid().optional(),
      name_prefix: z.string().trim().min(3).max(85),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(5),
      first_time: z.string().regex(/^(0[6-9]|1\d|20):00$/, "Selecione um horário inicial entre 06:00 e 20:00."),
      last_time: z.string().regex(/^(0[6-9]|1\d|20):00$/, "Selecione um horário final entre 06:00 e 20:00."),
      interval_minutes: z.union([z.literal(60), z.literal(120), z.literal(180), z.literal(240)]).default(60),
      starts_on: z.string().date().optional(),
      ends_on: z.string().date().optional(),
      duration_minutes: z.number().int().min(15).max(240),
      capacity: z.number().int().min(3).max(7).default(7),
    }).refine((value) => value.last_time >= value.first_time, {
      message: "O horário final não pode ser anterior ao horário inicial.",
      path: ["last_time"],
    }).refine((value) => {
      const firstHour = Number(value.first_time.slice(0, 2));
      const lastHour = Number(value.last_time.slice(0, 2));
      return lastHour < firstHour || (lastHour - firstHour) % (value.interval_minutes / 60) === 0;
    }, {
      message: "A faixa selecionada não fecha exatamente com o intervalo entre as turmas.",
      path: ["last_time"],
    }).refine((value) => !value.ends_on || Boolean(value.starts_on && value.ends_on >= value.starts_on), {
      message: "A data final da turma não pode ser anterior à data inicial.",
      path: ["ends_on"],
    }).parse(await context.req.json());
    const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
    if (professionalError) return professionalError;
    const scopeError = await validateRelatedResourceScope(context, input);
    if (scopeError) return scopeError;

    const firstHour = Number(input.first_time.slice(0, 2));
    const lastHour = Number(input.last_time.slice(0, 2));
    const intervalHours = input.interval_minutes / 60;
    const times = Array.from(
      { length: Math.floor((lastHour - firstHour) / intervalHours) + 1 },
      (_, index) => `${String(firstHour + index * intervalHours).padStart(2, "0")}:00`,
    );
    const normalizedWeekdays = [...new Set(input.weekdays)].sort();
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: conflictingSlots, error: conflictError } = await db.from("group_slots")
      .select("id,name,weekdays,starts_at,starts_on,ends_on")
      .eq("clinic_id", clinicId).eq("unit_id", input.unit_id).in("starts_at", times).eq("active", true).is("deleted_at", null);
    if (conflictError) return databaseResult(context, null, conflictError);
    const conflictingGroup = (conflictingSlots ?? []).find((slot: any) => groupPeriodsOverlap(slot, input)
      && (slot.weekdays ?? []).some((day: number) => normalizedWeekdays.includes(day)));
    if (conflictingGroup) {
      return fail(context, 409, "GROUP_SLOT_CONFLICT", "A grade não foi criada porque um dos horários já está ocupado para os dias selecionados.", {
        conflictingGroup: {
          id: conflictingGroup.id,
          name: conflictingGroup.name,
          weekdays: conflictingGroup.weekdays,
          startsAt: String(conflictingGroup.starts_at).slice(0, 5),
          startsOn: conflictingGroup.starts_on,
          endsOn: conflictingGroup.ends_on,
        },
      });
    }

    const rows = times.map((time) => ({
      unit_id: input.unit_id,
      room_id: input.room_id,
      professional_id: input.professional_id,
      service_id: input.service_id,
      name: `${input.name_prefix} · ${time.slice(0, 2)}h`,
      weekdays: normalizedWeekdays,
      starts_at: time,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      duration_minutes: input.duration_minutes,
      capacity: input.capacity,
      clinic_id: clinicId,
    }));
    const { data, error } = await db.from("group_slots").insert(rows).select();
    if (!error && data) {
      await Promise.all(data.map((slot: any) => audit(context, "group_slot.created_bulk", "group_slot", slot.id, slot.unit_id)));
    }
    return databaseResult(context, { items: data ?? [], created: data?.length ?? 0 }, error, 201);
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
    const input = z.object({
      room_id: z.string().uuid().nullable().optional(),
      professional_id: z.string().uuid().optional(),
      service_id: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(3).max(100).optional(),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional(),
      starts_at: z.string().regex(/^(0[6-9]|1\d|20):00(?::00)?$/, "Selecione um dos horários fixos entre 06:00 e 20:00.").optional(),
      starts_on: z.string().date().nullable().optional(),
      ends_on: z.string().date().nullable().optional(),
      duration_minutes: z.number().int().min(15).max(240).optional(),
      capacity: z.number().int().min(3).max(7).optional(),
      active: z.boolean().optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, {
      message: "Informe ao menos um dado para atualizar.",
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,room_id,professional_id,service_id,name,weekdays,starts_at,starts_on,ends_on,duration_minutes,capacity,active")
      .eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle();
    if (slotError) return databaseResult(context, null, slotError);
    if (!slot) return fail(context, 404, "GROUP_SLOT_NOT_FOUND", "Horário não encontrado.");
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");

    const target = {
      ...slot,
      ...input,
      weekdays: input.weekdays ? [...new Set(input.weekdays)].sort() : slot.weekdays,
      starts_on: input.starts_on === undefined ? slot.starts_on : input.starts_on,
      ends_on: input.ends_on === undefined ? slot.ends_on : input.ends_on,
    };
    if (target.ends_on && (!target.starts_on || target.ends_on < target.starts_on)) {
      return fail(context, 400, "INVALID_GROUP_PERIOD", "A data final da turma não pode ser anterior à data inicial.");
    }
    if (target.professional_id) {
      const professionalError = await validateActiveProfessional(context, target.professional_id, slot.unit_id);
      if (professionalError) return professionalError;
    }
    const scopeError = await validateRelatedResourceScope(context, {
      unit_id: slot.unit_id,
      professional_id: target.professional_id ?? undefined,
      room_id: target.room_id ?? undefined,
      service_id: target.service_id ?? undefined,
    });
    if (scopeError) return scopeError;
    // Registros antigos podem ter horários sobrepostos. Uma edição administrativa
    // (por exemplo, trocar o responsável) não deve ser bloqueada por esse legado;
    // o conflito é revalidado quando a grade muda ou uma turma é reativada.
    if (target.active && groupScheduleChanged(slot, target)) {
      const { data: conflictingSlots, error: conflictError } = await db.from("group_slots")
        .select("id,name,weekdays,starts_at,starts_on,ends_on")
        .eq("clinic_id", clinicId).eq("unit_id", slot.unit_id).eq("starts_at", target.starts_at)
        .eq("active", true).is("deleted_at", null).neq("id", id);
      if (conflictError) return databaseResult(context, null, conflictError);
      const conflictingGroup = (conflictingSlots ?? []).find((candidate: any) => groupPeriodsOverlap(candidate, target) && (candidate.weekdays ?? []).some((day: number) => target.weekdays.includes(day)));
      if (conflictingGroup) {
        return fail(context, 409, "GROUP_SLOT_CONFLICT", "Já existe outra turma nesta unidade para o mesmo dia e horário.", {
          conflictingGroup: {
            id: conflictingGroup.id,
            name: conflictingGroup.name,
            weekdays: conflictingGroup.weekdays,
            startsAt: String(conflictingGroup.starts_at).slice(0, 5),
            startsOn: conflictingGroup.starts_on,
            endsOn: conflictingGroup.ends_on,
          },
        });
      }
    }

    const { data, error } = await db.from("group_slots").update({
      ...input,
      ...(input.weekdays ? { weekdays: target.weekdays } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).select().single();
    if (!error && data) await audit(context, "group_slot.updated", "group_slot", id, slot.unit_id, { changedFields: Object.keys(input) });
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
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
    }).strict().parse(await context.req.json());
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
    const { data: existingMembership } = await db.from("group_slot_memberships").select("id").eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("patient_id", input.patient_id).eq("status", "active").is("deleted_at", null).maybeSingle();
    if (existingMembership) return ok(context, existingMembership);
    const { count, error: countError } = await db.from("group_slot_memberships").select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("status", "active").is("deleted_at", null);
    if (countError) return databaseResult(context, null, countError);
    if ((count ?? 0) >= slot.capacity) {
      return fail(context, 409, "GROUP_CAPACITY_REACHED", "A turma já atingiu a capacidade configurada.");
    }
    const { data, error } = await db.from("group_slot_memberships").insert({
      ...input,
      weekdays: slot.weekdays,
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
      group_slot_id: z.string().uuid().optional(),
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
    }).strict().refine((value) => !value.ends_at || value.ends_at >= value.starts_at, {
      message: "A data final não pode ser anterior à inicial.",
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: current, error: currentError } = await db.from("group_slot_memberships")
      .select("id,group_slot_id,enrollment_id")
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).single();
    if (currentError || !current) return databaseResult(context, null, currentError);
    const targetGroupSlotId = input.group_slot_id ?? current.group_slot_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("weekdays,capacity,unit_id")
      .eq("id", targetGroupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot) return databaseResult(context, null, slotError);
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data: enrollment, error: enrollmentError } = await db.from("enrollments").select("unit_id")
      .eq("id", current.enrollment_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle();
    if (enrollmentError) return databaseResult(context, null, enrollmentError);
    if (!enrollment || enrollment.unit_id !== slot.unit_id) return fail(context, 400, "INVALID_ENROLLMENT", "A turma deve pertencer à mesma unidade da matrícula.");
    const { count, error: countError } = await db.from("group_slot_memberships").select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).eq("group_slot_id", targetGroupSlotId).eq("status", "active").is("deleted_at", null).neq("id", id);
    if (countError) return databaseResult(context, null, countError);
    if ((count ?? 0) >= slot.capacity) {
      return fail(context, 409, "GROUP_CAPACITY_REACHED", "A turma já atingiu a capacidade configurada.");
    }
    const { data, error } = await db.from("group_slot_memberships")
      .update({ ...input, weekdays: slot.weekdays, updated_at: new Date().toISOString() })
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).select("id,group_slot_id,weekdays,starts_at,ends_at").single();
    if (!error && data) await audit(context, "group_slot.member_updated", "group_slot_membership", id);
    return databaseResult(context, data, error);
  });
  
  app.post("/appointments/:id/complete", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
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
