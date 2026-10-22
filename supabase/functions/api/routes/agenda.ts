import { z } from "npm:zod@3.24.2";

const CLASS_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function registerAgendaRoutes(app: any, dependencies: any) {
  const { appointmentFields, appointmentSchema, requireRoles, ok, fail, databaseResult, validateRelatedResourceScope, hasUnitAccess, audit, professionalForUser, isOwnProfessional, getAuthorizedAppointment } = dependencies;
  app.post("/admin/agenda/backfill-legacy", requireRoles(["admin"]), async (context: any) => {
    return fail(context, 409, "LEGACY_RECONCILIATION_REQUIRED", "A migração em massa exige reconciliação prévia de referências e autorização específica.");
  });

  async function readAll(query: any) {
    const rows: any[] = [];
    for (let page = 0; ; page += 1) {
      const { data, error } = await query.range(page * 500, page * 500 + 499);
      if (error) return { data: null, error };
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) return { data: rows, error: null };
    }
  }
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
      INVALID_OCCURRENCE_STATE_TRANSITION: [409, "Esta aula não pode ter participantes alterados no estado atual."],
      CLASS_CAPACITY_REACHED: [409, "Esta aula já atingiu a capacidade máxima."],
      PATIENT_SCHEDULE_CONFLICT: [409, "O paciente possui outro compromisso neste horário."],
      PATIENT_NOT_FOUND: [404, "Paciente não encontrado."],
      PATIENT_NOT_IN_OCCURRENCE_ROSTER: [409, "Este paciente não faz parte da chamada desta aula."],
      OCCURRENCE_PARTICIPANT_NOT_FOUND: [409, "Participante da aula não encontrado."],
      ATTENDANCE_CORRECTION_FORBIDDEN: [403, "Somente gestão pode corrigir uma chamada já registrada."],
      ATTENDANCE_CORRECTION_REASON_REQUIRED: [422, "Informe o motivo da correção (mínimo de 3 caracteres)."],
      INVALID_ATTENDANCE_STATUS: [422, "Estado de presença inválido."],
      FORBIDDEN: [403, "Você não tem permissão para esta chamada."],
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
    const { data, error } = await db.rpc("save_operational_membership", {p_group_id:classId,p_patient_id:input.patientId,p_from:input.effectiveFrom,p_to:input.effectiveTo??null,p_weekdays:input.weekdays,p_enrollment_id:input.enrollmentId??null});
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
    const { data: member, error: memberError } = await db.from("class_memberships").select("patient_id,enrollment_id,effective_to").eq("id", membershipId).single();
    if (memberError) return databaseResult(context, null, memberError);
    const { data, error } = await db.rpc("save_operational_membership", { p_group_id: membership.class_id, p_patient_id: member.patient_id, p_from: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), p_to: member.effective_to, p_weekdays: input.weekdays, p_enrollment_id: member.enrollment_id, p_id: membershipId });
    return classScheduleDatabaseResult(context, data ? { ...data, effectiveWeekdays: data.weekdays } : data, error);
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
    }, { agendaRead: true, substitution: true, crossUnitPatient: true });
    if (scopeError) return scopeError;
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const materialized = await db.rpc("ensure_calendar_window", { p_unit_id: query.unitId, p_from: query.from.slice(0, 10), p_to: query.to.slice(0, 10) });
    if (materialized.error) return classScheduleDatabaseResult(context, null, materialized.error);
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
      query.type === "APPOINTMENT" ? Promise.resolve({ data: [], error: null }) : readAll(occurrencesQuery.order("id")),
      query.type === "CLASS_OCCURRENCE" ? Promise.resolve({ data: [], error: null }) : readAll(appointmentsQuery.order("id")),
    ]);
    if (occurrencesResult.error) return databaseResult(context, null, occurrencesResult.error);
    if (appointmentsResult.error) return databaseResult(context, null, appointmentsResult.error);
    const occurrenceRows = occurrencesResult.data ?? [];
    const occurrenceIds = occurrenceRows.map((o: any) => o.id);
    const rosterByOccurrence = new Map<string, string[]>();
    for (let offset = 0; offset < occurrenceIds.length; offset += 1000) {
      const { data: rosters, error: rosterError } = await db.rpc("calendar_occurrence_rosters", { p_ids: occurrenceIds.slice(offset, offset + 1000) });
      if (rosterError) return databaseResult(context, null, rosterError);
      for (const roster of rosters ?? []) rosterByOccurrence.set(roster.occurrence_id, roster.patient_ids ?? []);
    }
    const asOne = (value: any) => Array.isArray(value) ? value[0] ?? null : value ?? null;
    const occurrenceItems = occurrenceRows.filter((o: any) => !query.patientId || rosterByOccurrence.get(o.id)?.includes(query.patientId)).map((occurrence: any) => {
      const actualProfessional = asOne(occurrence.actual_professional);
      const plannedProfessional = asOne(occurrence.planned_professional);
      const classInfo = asOne(occurrence.classes);
      return {
        id: occurrence.id, sourceType: "CLASS_OCCURRENCE", sourceId: occurrence.id, unitId: occurrence.unit_id,
        startAt: occurrence.start_at, endAt: occurrence.end_at, status: occurrence.status, title: classInfo?.name ?? "Turma",
        professional: actualProfessional ?? plannedProfessional,
        plannedProfessional, actualProfessional,
        patient: null, class: classInfo, service: asOne(occurrence.services), room: asOne(occurrence.rooms),
        occupancy: rosterByOccurrence.get(occurrence.id)?.length ?? 0,
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

  const occurrenceActionSchema = z.object({ date: z.string().date(), reason: z.string().trim().min(3).max(1000), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), actualProfessionalId: z.string().uuid().nullable(), roomId: z.string().uuid().nullable() }).strict();
  async function getOccurrenceDetail(context: any, occurrenceId: string) {
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: occurrence, error } = await db.from("class_occurrences").select("id,class_id,class_schedule_id,local_date,calendar_date,exception_date,cancellation_reason,local_start_time,local_end_time,start_at,end_at,status,effective_capacity,room_id,planned_professional_id,actual_professional_id,classes(id,name),services(id,name),rooms(id,name),planned_professional:professionals!class_occurrences_planned_professional_id_fkey(id,name),actual_professional:professionals!class_occurrences_actual_professional_id_fkey(id,name)").eq("id", occurrenceId).eq("clinic_id", clinicId).maybeSingle();
    if (error) return databaseResult(context, null, error); if (!occurrence) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const { data: roster, error: rosterError } = await db.rpc("get_occurrence_attendance_details", { p_occurrence_id: occurrenceId });
    if (rosterError) return classScheduleDatabaseResult(context, null, rosterError);
    const asOne = (item: any) => Array.isArray(item) ? item[0] ?? null : item ?? null;
    const participants = (roster ?? []).map((row: any) => ({ patient: { id: row.patient_id, name: row.patient_name, active: row.patient_active }, source: row.source_type === "makeup_reservation" ? "MAKEUP" : row.source_type === "membership" ? "MEMBERSHIP" : "MANUAL" }));
    return ok(context, { occurrence: { ...occurrence, classes: asOne(occurrence.classes), services: asOne(occurrence.services), rooms: asOne(occurrence.rooms), plannedProfessional: asOne(occurrence.planned_professional), actualProfessional: asOne(occurrence.actual_professional) }, participants, occupancy: participants.length });
  }
  app.get("/class-occurrences/:id", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => getOccurrenceDetail(context, z.string().uuid().parse(context.req.param("id"))));
  app.get("/class-occurrences/:id/attendance", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").rpc("get_occurrence_attendance_details", { p_occurrence_id: id });
    if (error) return classScheduleDatabaseResult(context, data, error);
    return ok(context, { items: data ?? [] });
  });
  app.put("/class-occurrences/:id/attendance/:patientId", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const patientId = z.string().uuid().parse(context.req.param("patientId"));
    const input = z.object({ status: z.enum(["PRESENT", "LATE", "ABSENT_JUSTIFIED", "ABSENT_UNJUSTIFIED", "CANCELLED_IN_ADVANCE", "CANCELLED_LATE"]), reason: z.string().trim().min(3).max(500).optional(), expectedVersion: z.number().int().positive().nullable().optional(), notes: z.string().max(2000).nullable().optional() }).strict().parse(await context.req.json());
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: target, error: targetError } = await db.from("class_occurrences").select("unit_id").eq("id", id).eq("clinic_id", clinicId).maybeSingle();
    if (targetError) return databaseResult(context, null, targetError); if (!target) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const scopeError = context.get("profile").role === "professional" ? null : await validateRelatedResourceScope(context, { unit_id: target.unit_id, patient_id: patientId }, { crossUnitPatient: true });
    if (scopeError) return scopeError;
    const { data, error } = await db.rpc("save_occurrence_attendance", { p_occurrence_id: id, p_patient_id: patientId, p_status: input.status, p_reason: input.reason ?? null, p_expected_version: input.expectedVersion ?? null, p_notes: input.notes ?? null });
    if (error) return classScheduleDatabaseResult(context, data, error);
    if (data?.status === "recorded" || data?.status === "corrected") await audit(context, `attendance.${data.status}`, "attendance", data.attendanceId, target.unit_id, { occurrenceId: id, patientId, attendanceStatus: input.status });
    return ok(context, data);
  });
  app.get("/class-occurrences/:id/available-participants", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const rawSearch = z.string().trim().min(2).max(80).parse(context.req.query("search") ?? "");
    const search = rawSearch.replace(/[%_,()]/g, "").trim();
    if (search.length < 2) return fail(context, 422, "INVALID_PATIENT_SEARCH", "Informe ao menos 2 letras do nome do paciente.");
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: canEditAgenda, error: permissionError } = await db.rpc("has_module_permission", { target_module: "agenda", edit_access: true });
    if (permissionError || canEditAgenda !== true) return fail(context, 403, "MODULE_FORBIDDEN", "Seu usuário não tem permissão para editar a agenda.");
    const { data: occurrence, error } = await db.from("class_occurrences").select("id,unit_id,status").eq("id", id).eq("clinic_id", clinicId).maybeSingle();
    if (error) return databaseResult(context, null, error); if (!occurrence) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    if (!(await hasUnitAccess(context, occurrence.unit_id))) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    if (occurrence.status !== "planned") return fail(context, 409, occurrence.status === "cancelled" ? "OCCURRENCE_CANCELLED" : "INVALID_OCCURRENCE_STATE_TRANSITION", occurrence.status === "cancelled" ? "Esta aula já foi cancelada." : "Esta aula não pode ter participantes alterados no estado atual.");
    const { data: rosterRows, error: rosterError } = await db.rpc("effective_occurrence_patient_ids", { p_occurrence_id: id });
    if (rosterError) return databaseResult(context, null, rosterError);
    const currentIds = new Set((rosterRows ?? []).map((participant: any) => participant.patient_id));
    const { data, error: patientError } = await db.from("patients").select("id,name,active").eq("clinic_id", clinicId).is("deleted_at", null).ilike("name", `%${search}%`).order("name").limit(20);
    if (patientError) return databaseResult(context, null, patientError);
    return ok(context, { items: (data ?? []).filter((patient: any) => !currentIds.has(patient.id)).map(({ id: patientId, name, active }: any) => ({ id: patientId, name, active })) });
  });
  app.post("/class-occurrences/:id/participants", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const input = z.object({ patientId: z.string().uuid() }).strict().parse(await context.req.json());
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: target, error: targetError } = await db.from("class_occurrences").select("unit_id").eq("id", id).eq("clinic_id", clinicId).maybeSingle();
    if (targetError) return databaseResult(context, null, targetError); if (!target) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const scopeError = await validateRelatedResourceScope(context, { unit_id: target.unit_id, patient_id: input.patientId }, { crossUnitPatient: true });
    if (scopeError) return scopeError;
    const { data, error } = await db.rpc("add_occurrence_participant", { p_occurrence_id: id, p_patient_id: input.patientId });
    if (error) return classScheduleDatabaseResult(context, data, error);
    if (data?.status === "added") await audit(context, "class_occurrence.participant_added", "occurrence_participant", data.participantId, target.unit_id, { occurrenceId: id, patientId: input.patientId, sourceType: data.sourceType });
    return ok(context, data, data?.status === "added" ? 201 : 200);
  });
  app.delete("/class-occurrences/:id/participants/:patientId", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const patientId = z.string().uuid().parse(context.req.param("patientId"));
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const { data: target, error: targetError } = await db.from("class_occurrences").select("unit_id").eq("id", id).eq("clinic_id", clinicId).maybeSingle();
    if (targetError) return databaseResult(context, null, targetError); if (!target) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const scopeError = context.get("profile").role === "professional" ? null : await validateRelatedResourceScope(context, { unit_id: target.unit_id, patient_id: patientId }, { crossUnitPatient: true });
    if (scopeError) return scopeError;
    const { data, error } = await db.rpc("remove_occurrence_participant", { p_occurrence_id: id, p_patient_id: patientId });
    if (error) return classScheduleDatabaseResult(context, data, error);
    if (data?.status === "removed") await audit(context, "class_occurrence.participant_removed", "occurrence_participant", null, target.unit_id, { occurrenceId: id, patientId, sourceType: data.sourceType });
    return ok(context, data);
  });
  app.patch("/class-occurrences/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const input = occurrenceActionSchema.parse(await context.req.json());
    if (input.startTime >= input.endTime) return fail(context, 422, "INVALID_TIME_RANGE", "O horário de início deve ser anterior ao horário final.");
    const { data: target, error: targetError } = await context.get("db").from("class_occurrences").select("unit_id").eq("id", id).eq("clinic_id", context.get("profile").clinic_id).maybeSingle();
    if (targetError) return databaseResult(context, null, targetError); if (!target) return fail(context, 404, "CLASS_OCCURRENCE_NOT_FOUND", "Aula não encontrada.");
    const scopeError = await validateRelatedResourceScope(context, { unit_id: target.unit_id, professional_id: input.actualProfessionalId ?? undefined, room_id: input.roomId ?? undefined }, { substitution: true });
    if (scopeError) return scopeError;
    const { data, error } = await context.get("db").rpc("reschedule_class_occurrence", { p_id: id, p_date: input.date, p_start: input.startTime, p_end: input.endTime, p_professional: input.actualProfessionalId, p_room: input.roomId, p_reason: input.reason });
    if (error) return classScheduleDatabaseResult(context, data, error); await audit(context, "class_occurrence.updated", "class_occurrence", id, data.unit_id, { changedFields: ["startTime", "endTime", "actualProfessionalId", "roomId"] }); return ok(context, data);
  });
  app.post("/class-occurrences/:id/reopen", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id=z.string().uuid().parse(context.req.param("id")); const input=z.object({reason:z.string().trim().min(3).max(1000)}).parse(await context.req.json());
    const {data,error}=await context.get("db").rpc("reopen_holiday_occurrence", {p_id:id,p_reason:input.reason});
    return databaseResult(context,data,error);
  });
  app.post("/class-occurrences/:id/cancel", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id")); const { data, error } = await context.get("db").rpc("cancel_class_occurrence", { p_occurrence_id: id });
    if (error) return classScheduleDatabaseResult(context, data, error); await audit(context, "class_occurrence.cancelled", "class_occurrence", id, data.unit_id); return ok(context, data);
  });
  app.get("/attendance/daily", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const day = z.string().date().parse(context.req.query("date"));
    const unitId = z.string().uuid().parse(context.req.query("unitId"));
    if ((await context.get("db").rpc("can_view_agenda_unit", { target_unit: unitId })).data !== true) return fail(context, 403, "UNIT_FORBIDDEN", "Seu perfil não possui acesso a esta unidade.");
    const db = context.get("db");
    const nextDay = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
    const { error: generationError } = await db.rpc("ensure_calendar_window", { p_unit_id: unitId, p_from: day, p_to: nextDay });
    if (generationError) return classScheduleDatabaseResult(context, null, generationError);
    let query = db.from("class_occurrences").select("*,units(name),classes(name),professionals!class_occurrences_planned_professional_id_fkey(name),actual_professional:professionals!class_occurrences_actual_professional_id_fkey(name)").eq("clinic_id", context.get("profile").clinic_id).eq("unit_id", unitId).eq("calendar_date", day).neq("status", "cancelled").order("start_at");
    if (context.get("profile").role === "professional") {
      const own = await professionalForUser(context);
      if (!own) return fail(context, 403, "PROFESSIONAL_NOT_LINKED", "Vincule seu usuário a um profissional.");
      query = query.or(`actual_professional_id.eq.${own},and(actual_professional_id.is.null,planned_professional_id.eq.${own})`);
    }
    const { data: occurrences, error } = await query;
    if (error) return databaseResult(context, null, error);
    const slots = [];
    for (const occurrence of occurrences ?? []) {
      const { data: roster, error: rosterError } = await db.rpc("get_occurrence_attendance_details", { p_occurrence_id: occurrence.id });
      if (rosterError) return classScheduleDatabaseResult(context, null, rosterError);
      slots.push({ ...occurrence, name: occurrence.classes?.name ?? "Turma", starts_at: occurrence.local_start_time, professionals: occurrence.actual_professional ?? occurrence.professionals,
        members: (roster ?? []).map((row: any) => ({ id: row.patient_id, occurrence_id: occurrence.id, patient_id: row.patient_id, patients: { name: row.patient_name }, attendance: row.attendance_id ? { id: row.attendance_id, status: row.attendance_status === "PRESENT" || row.attendance_status === "LATE" ? "present" : "absent", occurrence_status: row.attendance_status, version: row.version, notes: row.notes, history: row.history } : null })) });
    }
    const { data: makeups, error: makeupError } = await db.from("class_attendances").select("id,class_date,patient_id,group_slot_id,makeup_status,patients(name),group_slots(name,starts_at)").eq("clinic_id", context.get("profile").clinic_id).eq("unit_id", unitId).eq("status", "absent").eq("makeup_status", "pending").order("class_date").limit(500);
    return databaseResult(context, { slots, makeups: makeups ?? [] }, makeupError);
  });
  app.post("/attendance", requireRoles(["admin", "manager", "reception", "professional"]), (context: any) => fail(context, 409, "USE_OCCURRENCE_ATTENDANCE", "Abra a aula na Chamada diária para registrar ou corrigir a presença com histórico."));
  app.patch("/attendance/:id/makeup", requireRoles(["admin", "manager", "reception"]), (context: any) => fail(context, 409, "USE_MAKEUP_BOOKING", "Use Reposições e créditos para reservar ou encerrar a reposição com justificativa."));
  app.get("/makeup-credits", requireRoles(["admin", "manager", "reception", "professional"]), async (context: any) => {
    const { data, error } = await context.get("db").rpc("makeup_credits");
    return databaseResult(context, data, error);
  });
  app.post("/makeup-credits/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ action: z.enum(["reserve", "return", "forfeit", "approve"]), legacy: z.boolean().default(false), occurrenceId: z.string().uuid().nullable().optional(), reason: z.string().trim().min(3).max(1000).nullable().optional() }).strict().parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("manage_makeup_credit", { p_credit: id, p_action: input.action, p_occurrence: input.occurrenceId ?? null, p_reason: input.reason ?? null, p_legacy: input.legacy });
    return databaseResult(context, data, error);
  });
  app.post("/agenda-exceptions", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const input = z.object({ kind: z.enum(["holiday", "leave"]), unitId: z.string().uuid(), professionalId: z.string().uuid().nullable(), from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), reason: z.string().trim().min(3).max(1000) }).strict().parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("save_agenda_exception", { p_kind: input.kind, p_unit_id: input.unitId, p_professional_id: input.professionalId, p_from: input.from, p_to: input.to, p_reason: input.reason });
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
    }).refine((value: any) => value.ends_at > value.starts_at, {
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
      capacity: z.number().int().positive().default(7),
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
    let conflictQuery = db.from("group_slots").select("id,name,weekdays,starts_at,starts_on,ends_on")
      .eq("clinic_id", context.get("profile").clinic_id).eq("starts_at", input.starts_at).eq("active", true).is("deleted_at", null);
    conflictQuery = input.professional_id
      ? conflictQuery.eq("professional_id", input.professional_id)
      : conflictQuery.eq("unit_id", input.unit_id).is("professional_id", null);
    const { data: conflictingSlots, error: conflictError } = await conflictQuery;
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
      capacity: z.number().int().positive().default(7),
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
    let conflictQuery = db.from("group_slots")
      .select("id,name,weekdays,starts_at,starts_on,ends_on")
      .eq("clinic_id", clinicId).in("starts_at", times).eq("active", true).is("deleted_at", null);
    conflictQuery = input.professional_id
      ? conflictQuery.eq("professional_id", input.professional_id)
      : conflictQuery.eq("unit_id", input.unit_id).is("professional_id", null);
    const { data: conflictingSlots, error: conflictError } = await conflictQuery;
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
    const input = z.object({ name: z.string().trim().min(1).max(100).optional(), service_id: z.string().uuid().nullable().optional(), professional_id: z.string().uuid().nullable().optional(), room_id: z.string().uuid().nullable().optional(), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/).optional(), duration_minutes: z.number().int().min(15).max(240).optional(), capacity: z.number().int().positive().optional(), active: z.boolean().optional(), starts_on: z.string().date().nullable().optional(), ends_on: z.string().date().nullable().optional(), effective_from: z.string().date().optional() }).strict().parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("update_operational_group", { p_group_id: id, p_input: input });
    return classScheduleDatabaseResult(context, data, error);
  });
  app.delete("/group-slots/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const { data, error } = await context.get("db").rpc("update_operational_group", { p_group_id: id, p_input: { active: false } });
    return classScheduleDatabaseResult(context, data, error);
  });
  app.post("/group-slots/:id/members", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const groupId = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ patient_id: z.string().uuid(), enrollment_id: z.string().uuid().optional(), starts_at: z.string().date(), ends_at: z.string().date().optional(), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }).strict().parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("save_operational_membership", { p_group_id: groupId, p_patient_id: input.patient_id, p_from: input.starts_at, p_to: input.ends_at ? new Date(Date.parse(input.ends_at) + 86400000).toISOString().slice(0, 10) : null, p_weekdays: input.weekdays.map((day) => CLASS_DAYS[day]), p_enrollment_id: input.enrollment_id ?? null });
    return classScheduleDatabaseResult(context, data, error, 201);
  });
  app.delete("/group-slot-memberships/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const effectiveFrom = z.string().date().parse(context.req.query("effectiveFrom") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
    const { data, error } = await context.get("db").rpc("end_operational_membership", { p_id: id, p_effective_from: effectiveFrom });
    return classScheduleDatabaseResult(context, data, error);
  });
  app.patch("/group-slot-memberships/:id", requireRoles(["admin", "manager", "reception"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ group_slot_id: z.string().uuid().optional(), starts_at: z.string().date(), ends_at: z.string().date().optional(), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }).strict().parse(await context.req.json());
    const db = context.get("db");
    const { data: current, error: readError } = await db.from("class_memberships").select("id,class_id,patient_id,enrollment_id").eq("id", id).maybeSingle();
    if (readError) return databaseResult(context, null, readError);
    if (!current) return fail(context, 404, "CLASS_MEMBERSHIP_NOT_FOUND", "Vínculo não encontrado.");
    const { data, error } = await db.rpc("save_operational_membership", { p_group_id: input.group_slot_id ?? current.class_id, p_patient_id: current.patient_id, p_from: input.starts_at, p_to: input.ends_at ? new Date(Date.parse(input.ends_at) + 86400000).toISOString().slice(0, 10) : null, p_weekdays: input.weekdays.map((day) => CLASS_DAYS[day]), p_enrollment_id: current.enrollment_id, p_id: id });
    return classScheduleDatabaseResult(context, data, error);
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
