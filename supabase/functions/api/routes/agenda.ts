import { z } from "npm:zod@3.24.2";

export function registerAgendaRoutes(app: any, dependencies: any) {
  const { appointmentFields, appointmentSchema, requireRoles, ok, fail, databaseResult, validateRelatedResourceScope, hasUnitAccess, audit, professionalForUser, isOwnProfessional, getAuthorizedAppointment } = dependencies;
  app.post("/admin/agenda/backfill-legacy", requireRoles(["admin"]), async (context: any) => {
    const { data, error } = await context.get("db").rpc("backfill_active_group_slots_to_classes");
    if (!error) await audit(context, "agenda.legacy_backfill.executed", "agenda_backfill", null, null, {
      groupSlotsActive: data?.[0]?.group_slots_active ?? null,
      classesCreated: data?.[0]?.classes_created ?? null,
      failures: data?.[0]?.failures ?? null,
      ignored: data?.[0]?.ignored ?? null,
    });
    return databaseResult(context, data, error);
  });

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

  const classInputSchema = z.object({
    unitId: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    serviceId: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  }).strict();
  const classScheduleInputSchema = z.object({
    effectiveFrom: z.string().date(),
    weekdays: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).min(1).max(7),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
    timezone: z.string().trim().min(1).max(100),
    plannedProfessionalId: z.string().uuid().nullable().optional(),
    capacity: z.number().int().positive(),
    roomId: z.string().uuid().nullable().optional(),
  }).strict();
  const classMembershipInputSchema = z.object({
    patientId: z.string().uuid(), enrollmentId: z.string().uuid().nullable().optional(),
    effectiveFrom: z.string().date(), effectiveTo: z.string().date().nullable().optional(),
    weekdays: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).min(1).max(7),
  }).strict().refine((value) => !value.effectiveTo || value.effectiveTo > value.effectiveFrom, { message: "INVALID_MEMBERSHIP_PERIOD" });

  function scheduleValidationError(context: any, input: any) {
    if (new Set(input.weekdays).size !== input.weekdays.length) return fail(context, 422, "INVALID_WEEKDAYS", "Os dias da semana devem ser únicos.");
    if (input.startTime >= input.endTime) return fail(context, 422, "INVALID_TIME_RANGE", "O horário de início deve ser anterior ao horário final.");
    if (input.capacity <= 0) return fail(context, 422, "INVALID_CAPACITY", "A capacidade deve ser maior que zero.");
    return null;
  }

  async function getManagedClass(context: any, classId: string) {
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data, error } = await db.from("classes").select("id,unit_id,name,service_id,status")
      .eq("id", classId).eq("clinic_id", clinicId).maybeSingle();
    if (error) return databaseResult(context, null, error);
    if (!data) return fail(context, 404, "CLASS_NOT_FOUND", "Turma não encontrada.");
    if (!(await hasUnitAccess(context, data.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    return data;
  }

  function classScheduleDatabaseResult(context: any, data: any, error: any, status = 200) {
    if (!error) return databaseResult(context, data, null, status);
    const message = String(error.message ?? "");
    const stableErrors: Record<string, [number, string]> = {
      CLASS_NOT_FOUND: [404, "Turma não encontrada."],
      CLASS_SCHEDULE_NOT_FOUND: [404, "Schedule da turma não encontrado."],
      CLASS_SCHEDULE_OVERLAP: [409, "A vigência do schedule se sobrepõe a uma versão existente."],
      INVALID_SCHEDULE_EFFECTIVE_DATE: [422, "A data de vigência não é compatível com o schedule atual."],
      INVALID_TIME_RANGE: [422, "O horário de início deve ser anterior ao horário final."],
      INVALID_WEEKDAYS: [422, "Os dias da semana são inválidos."],
      INVALID_CAPACITY: [422, "A capacidade deve ser maior que zero."],
      CLASS_MEMBERSHIP_WEEKDAYS_CONFLICT: [409, "Há matrículas com dias explícitos incompatíveis com a nova grade."],
      PROFESSIONAL_NOT_AVAILABLE_FOR_UNIT: [422, "O profissional não está ativo nesta unidade."],
      PROFESSIONAL_SCHEDULE_CONFLICT: [409, "O profissional possui outro compromisso neste horário."],
      CLASS_OCCURRENCE_NOT_FOUND: [404, "Aula não encontrada."],
      OCCURRENCE_CANCELLED: [409, "Esta aula já foi cancelada."],
      INVALID_OCCURRENCE_STATE_TRANSITION: [409, "Esta aula não pode ser cancelada no estado atual."],
    };
    for (const [code, [httpStatus, detail]] of Object.entries(stableErrors)) {
      if (message.includes(code)) return fail(context, httpStatus, code, detail);
    }
    return databaseResult(context, data, error, status);
  }

  async function validateClassScheduleScope(context: any, unitId: string, input: any) {
    const scheduleError = scheduleValidationError(context, input);
    if (scheduleError) return scheduleError;
    const scopeError = await validateRelatedResourceScope(context, {
      unit_id: unitId,
      professional_id: input.plannedProfessionalId ?? undefined,
      room_id: input.roomId ?? undefined,
    });
    if (scopeError) return scopeError;
    if (input.plannedProfessionalId) {
      const professionalError = await validateActiveProfessional(context, input.plannedProfessionalId, unitId);
      if (professionalError) return professionalError;
    }
    return null;
  }

  app.post("/classes", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const input = classInputSchema.parse(await context.req.json());
    const scopeError = await validateRelatedResourceScope(context, { unit_id: input.unitId, service_id: input.serviceId ?? undefined });
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").from("classes").insert({
      clinic_id: context.get("profile").clinic_id, unit_id: input.unitId, name: input.name,
      service_id: input.serviceId ?? null, status: input.status ?? "active", created_by: context.get("user").id,
    }).select().single();
    if (!error && data) await audit(context, "class.created", "class", data.id, data.unit_id);
    return databaseResult(context, data, error, 201);
  });

  app.post("/classes/with-schedule", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const input = z.object({ ...classInputSchema.shape, schedule: classScheduleInputSchema }).strict().parse(await context.req.json());
    const classScopeError = await validateRelatedResourceScope(context, { unit_id: input.unitId, service_id: input.serviceId ?? undefined });
    if (classScopeError) return classScopeError;
    const scheduleScopeError = await validateClassScheduleScope(context, input.unitId, input.schedule);
    if (scheduleScopeError) return scheduleScopeError;
    const { data, error } = await context.get("db").rpc("create_class_with_schedule", {
      p_unit_id: input.unitId, p_name: input.name, p_service_id: input.serviceId ?? null, p_status: input.status ?? "active",
      p_effective_from: input.schedule.effectiveFrom, p_weekdays: input.schedule.weekdays, p_start_time: input.schedule.startTime,
      p_end_time: input.schedule.endTime, p_timezone: input.schedule.timezone, p_planned_professional_id: input.schedule.plannedProfessionalId ?? null,
      p_effective_capacity: input.schedule.capacity, p_room_id: input.schedule.roomId ?? null,
    });
    if (!error && data) await audit(context, "class.created", "class", data.class?.id, input.unitId, { withSchedule: true });
    return classScheduleDatabaseResult(context, data, error, 201);
  });

  app.post("/classes/:id/schedules", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const input = classScheduleInputSchema.parse(await context.req.json());
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const scopeError = await validateClassScheduleScope(context, targetClass.unit_id, input);
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").rpc("create_class_schedule", {
      p_class_id: classId, p_effective_from: input.effectiveFrom, p_weekdays: input.weekdays, p_start_time: input.startTime,
      p_end_time: input.endTime, p_timezone: input.timezone, p_planned_professional_id: input.plannedProfessionalId ?? null,
      p_effective_capacity: input.capacity, p_room_id: input.roomId ?? null,
    });
    if (!error && data) await audit(context, "class_schedule.created", "class_schedule", data.id, targetClass.unit_id, { classId });
    return classScheduleDatabaseResult(context, data, error, 201);
  });

  app.patch("/classes/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ name: z.string().trim().min(1).max(100).optional(), serviceId: z.string().uuid().nullable().optional(), status: z.enum(["active", "inactive"]).optional() }).strict().refine((value) => Object.keys(value).length > 0).parse(await context.req.json());
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const scopeError = await validateRelatedResourceScope(context, { unit_id: targetClass.unit_id, service_id: input.serviceId ?? undefined });
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").from("classes").update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.serviceId !== undefined ? { service_id: input.serviceId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}), updated_at: new Date().toISOString(),
    }).eq("id", classId).eq("clinic_id", context.get("profile").clinic_id).select().single();
    if (!error && data) await audit(context, "class.updated", "class", classId, targetClass.unit_id, { changedFields: Object.keys(input) });
    return databaseResult(context, data, error);
  });

  app.post("/classes/:id/schedule-changes", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const input = classScheduleInputSchema.extend({ effectiveFrom: z.string().date(), timezone: z.string().trim().min(1).max(100).optional() }).parse(await context.req.json());
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const scopeError = await validateClassScheduleScope(context, targetClass.unit_id, { ...input, timezone: input.timezone ?? "America/Sao_Paulo" });
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").rpc("change_class_schedule_from_date", {
      p_class_id: classId, p_effective_from: input.effectiveFrom, p_weekdays: input.weekdays, p_start_time: input.startTime,
      p_end_time: input.endTime, p_timezone: input.timezone ?? null, p_planned_professional_id: input.plannedProfessionalId ?? null,
      p_effective_capacity: input.capacity, p_room_id: input.roomId ?? null,
    });
    if (!error && data) await audit(context, "class_schedule.changed", "class_schedule", data.id, targetClass.unit_id, { classId, effectiveFrom: input.effectiveFrom });
    return classScheduleDatabaseResult(context, data, error, 201);
  });

  app.get("/classes/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const targetDate = z.string().date().catch(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())).parse(context.req.query("targetDate"));
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const { data: schedules, error } = await context.get("db").from("class_schedules").select("*")
      .eq("class_id", classId).eq("clinic_id", context.get("profile").clinic_id).order("effective_from");
    if (error) return databaseResult(context, null, error);
    const scheduleHistory = schedules ?? [];
    const currentSchedule = scheduleHistory.find((schedule: any) => schedule.effective_from <= targetDate && (!schedule.effective_to || targetDate < schedule.effective_to)) ?? null;
    return ok(context, { class: targetClass, currentSchedule, scheduleHistory });
  });

  app.get("/classes/:id/memberships", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const targetDate = z.string().date().catch(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())).parse(context.req.query("targetDate"));
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const db = context.get("db");
    const [{ data: schedule, error: scheduleError }, { data: memberships, error: membershipsError }] = await Promise.all([
      db.from("class_schedules").select("weekdays").eq("class_id", classId).eq("clinic_id", context.get("profile").clinic_id).lte("effective_from", targetDate).or(`effective_to.is.null,effective_to.gt.${targetDate}`).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      db.from("class_memberships").select("id,class_id,patient_id,effective_from,effective_to,weekdays,patients(id,name,phone)").eq("class_id", classId).eq("clinic_id", context.get("profile").clinic_id).order("effective_from"),
    ]);
    if (scheduleError || membershipsError) return databaseResult(context, null, scheduleError ?? membershipsError);
    return ok(context, { items: (memberships ?? []).map((membership: any) => ({ ...membership, effectiveWeekdays: membership.weekdays ?? schedule?.weekdays ?? [] })) });
  });

  app.post("/classes/:id/memberships", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const classId = z.string().uuid().parse(context.req.param("id"));
    const input = classMembershipInputSchema.parse(await context.req.json());
    const targetClass = await getManagedClass(context, classId);
    if (targetClass instanceof Response) return targetClass;
    const db = context.get("db");
    const { data: schedule, error: scheduleError } = await db.from("class_schedules").select("weekdays").eq("class_id", classId).eq("clinic_id", context.get("profile").clinic_id).lte("effective_from", input.effectiveFrom).or(`effective_to.is.null,effective_to.gt.${input.effectiveFrom}`).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    if (scheduleError || !schedule) return fail(context, 422, "CLASS_SCHEDULE_NOT_FOUND", "Não há schedule vigente para a data da matrícula.");
    if (new Set(input.weekdays).size !== input.weekdays.length || !input.weekdays.every((day) => schedule.weekdays.includes(day))) return fail(context, 422, "INVALID_MEMBERSHIP_WEEKDAYS", "Os dias do paciente devem pertencer à grade da turma.");
    const { data, error } = await db.from("class_memberships").insert({ clinic_id: context.get("profile").clinic_id, class_id: classId, patient_id: input.patientId, enrollment_id: input.enrollmentId ?? null, effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, weekdays: input.weekdays, created_by: context.get("user").id }).select().single();
    if (!error && data) await audit(context, "class.membership_created", "class_membership", data.id, targetClass.unit_id);
    return databaseResult(context, data ? { ...data, effectiveWeekdays: data.weekdays } : data, error, 201);
  });

  app.patch("/class-memberships/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const membershipId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ weekdays: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).min(1).max(7) }).strict().parse(await context.req.json());
    const db = context.get("db");
    const { data: membership, error: membershipError } = await db.from("class_memberships").select("id,class_id,effective_from").eq("id", membershipId).eq("clinic_id", context.get("profile").clinic_id).maybeSingle();
    if (membershipError || !membership) return databaseResult(context, null, membershipError);
    const targetClass = await getManagedClass(context, membership.class_id);
    if (targetClass instanceof Response) return targetClass;
    const { data: schedule, error: scheduleError } = await db.from("class_schedules").select("weekdays").eq("class_id", membership.class_id).eq("clinic_id", context.get("profile").clinic_id).lte("effective_from", membership.effective_from).or(`effective_to.is.null,effective_to.gt.${membership.effective_from}`).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    if (scheduleError || !schedule) return fail(context, 422, "CLASS_SCHEDULE_NOT_FOUND", "Não há schedule vigente para esta matrícula.");
    if (new Set(input.weekdays).size !== input.weekdays.length || !input.weekdays.every((day) => schedule.weekdays.includes(day))) return fail(context, 422, "INVALID_MEMBERSHIP_WEEKDAYS", "Os dias do paciente devem pertencer à grade da turma.");
    const { data, error } = await db.from("class_memberships").update({ weekdays: input.weekdays }).eq("id", membershipId).eq("clinic_id", context.get("profile").clinic_id).select().single();
    if (!error && data) await audit(context, "class.membership_weekdays_updated", "class_membership", data.id, targetClass.unit_id);
    return databaseResult(context, data ? { ...data, effectiveWeekdays: data.weekdays } : data, error);
  });

  app.get("/calendar-items", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const query = z.object({
      unitId: z.string().uuid(),
      from: z.string().datetime({ offset: true }),
      to: z.string().datetime({ offset: true }),
      professionalId: z.string().uuid().optional(),
      patientId: z.string().uuid().optional(),
      type: z.enum(["CLASS_OCCURRENCE", "APPOINTMENT"]).optional(),
    }).refine((value) => value.from < value.to, { message: "O fim da janela deve ser posterior ao início." }).parse({
      unitId: context.req.query("unitId"), from: context.req.query("from"), to: context.req.query("to"),
      professionalId: context.req.query("professionalId") ?? undefined, patientId: context.req.query("patientId") ?? undefined,
      type: context.req.query("type") ?? undefined,
    });
    const ownProfessionalId = context.get("profile").role === "professional" ? await professionalForUser(context) : undefined;
    if (context.get("profile").role === "professional" && !ownProfessionalId) return fail(context, 403, "PROFESSIONAL_NOT_LINKED", "Seu usuário não está vinculado a um profissional.");
    if (ownProfessionalId && query.professionalId && query.professionalId !== ownProfessionalId) return fail(context, 403, "PROFESSIONAL_FORBIDDEN", "Você só pode consultar sua própria agenda.");
    const effectiveProfessionalId = ownProfessionalId ?? query.professionalId;
    const scopeError = await validateRelatedResourceScope(context, {
      unit_id: query.unitId, professional_id: effectiveProfessionalId, patient_id: query.patientId,
    });
    if (scopeError) return scopeError;
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const occurrenceSelect = "id,class_id,class_schedule_id,local_date,unit_id,service_id,start_at,end_at,status,planned_professional_id,actual_professional_id,effective_capacity,room_id,classes(id,name),services(id,name),rooms(id,name),planned_professional:professionals!class_occurrences_planned_professional_id_fkey(id,name),actual_professional:professionals!class_occurrences_actual_professional_id_fkey(id,name)";
    let occurrencesQuery = db.from("class_occurrences").select(occurrenceSelect)
      .eq("clinic_id", clinicId).eq("unit_id", query.unitId).lt("start_at", query.to).gt("end_at", query.from);
    if (effectiveProfessionalId) occurrencesQuery = occurrencesQuery.or(`actual_professional_id.eq.${effectiveProfessionalId},and(actual_professional_id.is.null,planned_professional_id.eq.${effectiveProfessionalId})`);
    let appointmentsQuery = db.from("appointments")
      .select("id,unit_id,patient_id,professional_id,service_id,room_id,starts_at,ends_at,status,patients(id,name),professionals(id,name),services(id,name),rooms(id,name)")
      .eq("clinic_id", clinicId).eq("unit_id", query.unitId).lt("starts_at", query.to).gt("ends_at", query.from).is("deleted_at", null);
    if (effectiveProfessionalId) appointmentsQuery = appointmentsQuery.eq("professional_id", effectiveProfessionalId);
    if (query.patientId) appointmentsQuery = appointmentsQuery.eq("patient_id", query.patientId);
    const [occurrencesResult, appointmentsResult] = await Promise.all([
      query.type === "APPOINTMENT" ? Promise.resolve({ data: [], error: null }) : occurrencesQuery,
      query.type === "CLASS_OCCURRENCE" ? Promise.resolve({ data: [], error: null }) : appointmentsQuery,
    ]);
    if (occurrencesResult.error) return databaseResult(context, null, occurrencesResult.error);
    if (appointmentsResult.error) return databaseResult(context, null, appointmentsResult.error);
    const occurrenceRows = occurrencesResult.data ?? [];
    const classIds = [...new Set(occurrenceRows.map((occurrence: any) => occurrence.class_id))];
    const scheduleIds = [...new Set(occurrenceRows.map((occurrence: any) => occurrence.class_schedule_id))];
    const [{ data: memberships, error: membershipsError }, { data: occurrenceSchedules, error: schedulesError }] = await Promise.all([
      classIds.length ? db.from("class_memberships").select("class_id,effective_from,effective_to,weekdays").eq("clinic_id", clinicId).in("class_id", classIds) : Promise.resolve({ data: [], error: null }),
      scheduleIds.length ? db.from("class_schedules").select("id,weekdays").eq("clinic_id", clinicId).in("id", scheduleIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (membershipsError || schedulesError) return databaseResult(context, null, membershipsError ?? schedulesError);
    const scheduleWeekdays = new Map((occurrenceSchedules ?? []).map((schedule: any) => [schedule.id, schedule.weekdays]));
    const weekdayForLocalDate = (localDate: string) => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${localDate}T12:00:00Z`).getUTCDay()];
    const asOne = (value: any) => Array.isArray(value) ? value[0] ?? null : value ?? null;
    const occurrenceItems = occurrenceRows.map((occurrence: any) => {
      const actualProfessional = asOne(occurrence.actual_professional);
      const plannedProfessional = asOne(occurrence.planned_professional);
      const classInfo = asOne(occurrence.classes);
      return {
        id: occurrence.id, sourceType: "CLASS_OCCURRENCE", sourceId: occurrence.id, unitId: occurrence.unit_id,
        startAt: occurrence.start_at, endAt: occurrence.end_at, status: occurrence.status, title: classInfo?.name ?? "Turma",
        professional: actualProfessional ?? plannedProfessional,
        plannedProfessional, actualProfessional,
        patient: null, class: classInfo, service: asOne(occurrence.services), room: asOne(occurrence.rooms),
        occupancy: (memberships ?? []).filter((membership: any) => membership.class_id === occurrence.class_id
          && membership.effective_from <= occurrence.local_date && (!membership.effective_to || occurrence.local_date < membership.effective_to)
          && (membership.weekdays ?? scheduleWeekdays.get(occurrence.class_schedule_id) ?? []).includes(weekdayForLocalDate(occurrence.local_date))).length,
        capacity: occurrence.effective_capacity,
      };
    });
    const appointmentItems = (appointmentsResult.data ?? []).map((appointment: any) => {
      const patient = asOne(appointment.patients);
      return {
        id: appointment.id, sourceType: "APPOINTMENT", sourceId: appointment.id, unitId: appointment.unit_id,
        startAt: appointment.starts_at, endAt: appointment.ends_at, status: appointment.status,
        title: patient?.name ?? "Bloqueio de agenda", professional: asOne(appointment.professionals), patient,
        class: null, service: asOne(appointment.services), room: asOne(appointment.rooms), occupancy: null, capacity: null,
      };
    });
    const items = [...occurrenceItems, ...appointmentItems].sort((first, second) => first.startAt.localeCompare(second.startAt) || first.sourceType.localeCompare(second.sourceType) || first.id.localeCompare(second.id));
    return ok(context, { items });
  });

  const occurrenceActionSchema = z.object({ startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), actualProfessionalId: z.string().uuid().nullable(), roomId: z.string().uuid().nullable() }).strict();
  async function getOccurrenceDetail(context: any, occurrenceId: string) {
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: occurrence, error } = await db.from("class_occurrences").select("id,class_id,class_schedule_id,local_date,local_start_time,local_end_time,start_at,end_at,status,effective_capacity,room_id,planned_professional_id,actual_professional_id,classes(id,name),services(id,name),rooms(id,name),planned_professional:professionals!class_occurrences_planned_professional_id_fkey(id,name),actual_professional:professionals!class_occurrences_actual_professional_id_fkey(id,name)").eq("id", occurrenceId).eq("clinic_id", clinicId).maybeSingle();
    if (error) return databaseResult(context, null, error); if (!occurrence) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const [{ data: schedule, error: scheduleError }, { data: memberships, error: membershipsError }] = await Promise.all([
      db.from("class_schedules").select("weekdays").eq("id", occurrence.class_schedule_id).eq("clinic_id", clinicId).maybeSingle(),
      db.from("class_memberships").select("id,patient_id,effective_from,effective_to,weekdays,patients(id,name,active,deleted_at)").eq("class_id", occurrence.class_id).eq("clinic_id", clinicId),
    ]);
    if (scheduleError || membershipsError) return databaseResult(context, null, scheduleError ?? membershipsError);
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${occurrence.local_date}T12:00:00Z`).getUTCDay()];
    const asOne = (item: any) => Array.isArray(item) ? item[0] ?? null : item ?? null;
    const participants = (memberships ?? []).filter((membership: any) => membership.effective_from <= occurrence.local_date && (!membership.effective_to || occurrence.local_date < membership.effective_to) && (membership.weekdays ?? schedule?.weekdays ?? []).includes(weekday) && !asOne(membership.patients)?.deleted_at).map((membership: any) => ({ id: membership.id, patient: { id: asOne(membership.patients)?.id, name: asOne(membership.patients)?.name, active: asOne(membership.patients)?.active !== false }, effectiveWeekdays: membership.weekdays ?? schedule?.weekdays ?? [] }));
    return ok(context, { occurrence: { ...occurrence, classes: asOne(occurrence.classes), services: asOne(occurrence.services), rooms: asOne(occurrence.rooms), plannedProfessional: asOne(occurrence.planned_professional), actualProfessional: asOne(occurrence.actual_professional) }, participants, occupancy: participants.length });
  }
  app.get("/class-occurrences/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => getOccurrenceDetail(context, z.string().uuid().parse(context.req.param("id"))));
  app.patch("/class-occurrences/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const input = occurrenceActionSchema.parse(await context.req.json());
    if (input.startTime >= input.endTime) return fail(context, 422, "INVALID_TIME_RANGE", "O horário de início deve ser anterior ao horário final.");
    const { data: target, error: targetError } = await context.get("db").from("class_occurrences").select("unit_id").eq("id", id).eq("clinic_id", context.get("profile").clinic_id).maybeSingle();
    if (targetError) return databaseResult(context, null, targetError); if (!target) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const scopeError = await validateRelatedResourceScope(context, { unit_id: target.unit_id, professional_id: input.actualProfessionalId ?? undefined, room_id: input.roomId ?? undefined });
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").rpc("update_class_occurrence", { p_occurrence_id: id, p_start_time: input.startTime, p_end_time: input.endTime, p_actual_professional_id: input.actualProfessionalId, p_room_id: input.roomId });
    if (error) return classScheduleDatabaseResult(context, data, error); await audit(context, "class_occurrence.updated", "class_occurrence", id, data.unit_id, { changedFields: ["startTime", "endTime", "actualProfessionalId", "roomId"] }); return ok(context, data);
  });
  app.post("/class-occurrences/:id/cancel", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const { data, error } = await context.get("db").rpc("cancel_class_occurrence", { p_occurrence_id: id });
    if (error) return classScheduleDatabaseResult(context, data, error); await audit(context, "class_occurrence.cancelled", "class_occurrence", id, data.unit_id); return ok(context, data);
  });
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
    const effectiveWeekdays = membership.weekdays ?? slot?.weekdays ?? [];
    const validDate = effectiveWeekdays.includes(weekday)
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
      p_patient_id: input.patient_id ?? null,
    });
    if (conflictError) return databaseResult(context, null, conflictError);
    if (conflict?.professional_conflict) return fail(context, 409, "PROFESSIONAL_SCHEDULE_CONFLICT", "O profissional já possui compromisso nesse horário.");
    if (conflict?.patient_conflict) return fail(context, 409, "PATIENT_SCHEDULE_CONFLICT", "O paciente já possui compromisso nesse horário.");
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
      p_patient_id: input.patient_id ?? null,
    });
    if (conflictError) return databaseResult(context, null, conflictError);
    if (conflict?.professional_conflict) return fail(context, 409, "PROFESSIONAL_SCHEDULE_CONFLICT", "O profissional já possui compromisso nesse horário.");
    if (conflict?.patient_conflict) return fail(context, 409, "PATIENT_SCHEDULE_CONFLICT", "O paciente já possui compromisso nesse horário.");
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
      professional_id: z.string().uuid().optional(),
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
    if (input.professional_id) {
      const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
      if (professionalError) return professionalError;
    }
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

  app.post("/group-slots/bulk", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const input = z.object({
      unit_id: z.string().uuid(),
      room_id: z.string().uuid().optional(),
      professional_id: z.string().uuid().optional(),
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
    if (input.professional_id) {
      const professionalError = await validateActiveProfessional(context, input.professional_id, input.unit_id);
      if (professionalError) return professionalError;
    }
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
      professional_id: input.professional_id ?? null,
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
      professional_id: z.string().uuid().nullable().optional(),
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
    const id = z.string().uuid().parse(context.req.param("id"));
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,name")
      .eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle();
    if (slotError) return databaseResult(context, null, slotError);
    if (!slot) return fail(context, 404, "GROUP_SLOT_NOT_FOUND", "Turma não encontrada.");
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data: activeMemberships, error: membershipsError } = await db.from("group_slot_memberships").select("id")
      .eq("clinic_id", clinicId).eq("group_slot_id", id).eq("status", "active").is("deleted_at", null).limit(1);
    if (membershipsError) return databaseResult(context, null, membershipsError);
    if (activeMemberships?.length) return fail(context, 409, "GROUP_SLOT_HAS_MEMBERS", "Retire os pacientes da turma antes de excluí-la.");
    const deletedAt = new Date().toISOString();
    const { data, error } = await db.from("group_slots").update({ active: false, deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", id).eq("clinic_id", clinicId).is("deleted_at", null).select("id,unit_id").single();
    if (!error && data) await audit(context, "group_slot.deleted", "group_slot", id, data.unit_id);
    return databaseResult(context, data, error);
  });
  
  app.post("/group-slots/:id/members", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const groupSlotId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({
      enrollment_id: z.string().uuid().optional(),
      patient_id: z.string().uuid(),
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    }).strict().parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("id,unit_id,capacity,weekdays")
      .eq("id", groupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot) return databaseResult(context, null, slotError);
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data: patient, error: patientError } = await db.from("patients").select("id")
      .eq("id", input.patient_id).eq("clinic_id", clinicId).eq("primary_unit_id", slot.unit_id).is("deleted_at", null).maybeSingle();
    if (patientError) return databaseResult(context, null, patientError);
    if (!patient) return fail(context, 400, "INVALID_PATIENT", "O paciente não pertence à unidade desta turma.");
    if (input.enrollment_id) {
      const { data: enrollment, error: enrollmentError } = await db.from("enrollments").select("id")
        .eq("id", input.enrollment_id).eq("clinic_id", clinicId).eq("patient_id", input.patient_id).eq("unit_id", slot.unit_id).eq("status", "active").is("deleted_at", null).maybeSingle();
      if (enrollmentError) return databaseResult(context, null, enrollmentError);
      if (!enrollment) return fail(context, 400, "INVALID_ENROLLMENT", "A matrícula não corresponde ao paciente e à unidade desta turma.");
    }
    if (input.ends_at && input.ends_at < input.starts_at) return fail(context, 400, "INVALID_PERIOD", "A data final não pode ser anterior à inicial.");
    if (new Set(input.weekdays).size !== input.weekdays.length || !input.weekdays.every((weekday) => slot.weekdays.includes(weekday))) return fail(context, 422, "INVALID_MEMBERSHIP_WEEKDAYS", "Os dias do paciente devem pertencer à turma.");
    const { data: existingMembership } = await db.from("group_slot_memberships").select("id").eq("clinic_id", clinicId).eq("group_slot_id", groupSlotId).eq("patient_id", input.patient_id).eq("status", "active").is("deleted_at", null).eq("starts_at", input.starts_at).maybeSingle();
    if (existingMembership) return ok(context, existingMembership);
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
      group_slot_id: z.string().uuid().optional(),
      starts_at: z.string().date(),
      ends_at: z.string().date().optional(),
      weekdays: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    }).strict().refine((value) => !value.ends_at || value.ends_at >= value.starts_at, {
      message: "A data final não pode ser anterior à inicial.",
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: current, error: currentError } = await db.from("group_slot_memberships")
      .select("id,group_slot_id,enrollment_id,patient_id")
      .eq("id", id).eq("clinic_id", clinicId).eq("status", "active").is("deleted_at", null).single();
    if (currentError || !current) return databaseResult(context, null, currentError);
    const targetGroupSlotId = input.group_slot_id ?? current.group_slot_id;
    const { data: slot, error: slotError } = await db.from("group_slots").select("weekdays,capacity,unit_id")
      .eq("id", targetGroupSlotId).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (slotError || !slot) return databaseResult(context, null, slotError);
    if (!(await hasUnitAccess(context, slot.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const { data: patient, error: patientError } = await db.from("patients").select("id")
      .eq("id", current.patient_id).eq("clinic_id", clinicId).eq("primary_unit_id", slot.unit_id).is("deleted_at", null).maybeSingle();
    if (patientError) return databaseResult(context, null, patientError);
    if (!patient) return fail(context, 400, "INVALID_PATIENT", "A turma deve pertencer à unidade atual do paciente.");
    if (current.enrollment_id) {
      const { data: enrollment, error: enrollmentError } = await db.from("enrollments").select("unit_id")
        .eq("id", current.enrollment_id).eq("clinic_id", clinicId).is("deleted_at", null).maybeSingle();
      if (enrollmentError) return databaseResult(context, null, enrollmentError);
      if (!enrollment || enrollment.unit_id !== slot.unit_id) return fail(context, 400, "INVALID_ENROLLMENT", "A turma deve pertencer à mesma unidade da matrícula.");
    }
    if (new Set(input.weekdays).size !== input.weekdays.length || !input.weekdays.every((weekday) => slot.weekdays.includes(weekday))) return fail(context, 422, "INVALID_MEMBERSHIP_WEEKDAYS", "Os dias do paciente devem pertencer à turma.");
    const { data, error } = await db.from("group_slot_memberships")
      .update({ ...input, updated_at: new Date().toISOString() })
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
