import { z } from "npm:zod@3.24.2";

export function registerImportacoesRoutes(app: any, dependencies: any) {
  const { requireRoles, databaseResult, listResource, requireIdempotency, transactionalImportResult, requiredEnv, validateNotionInventory, prepareNotionImport, audit, fail, ok } = dependencies;
  app.post("/imports", requireRoles(["admin", "manager"]), async (context: any) => {
    const key = requireIdempotency(context);
    const input = z.object({
      source: z.enum(["oluma", "notion", "manual"]),
      filename: z.string().min(1).max(240),
      mapping: z.record(z.string()).default({}),
    }).parse(await context.req.json());
    const { data, error } = await context.get("db").from("import_batches").insert({
      ...input,
      clinic_id: context.get("profile").clinic_id,
      created_by: context.get("user").id,
      idempotency_key: key,
      status: "uploaded",
    }).select().single();
    return databaseResult(context, data, error, 201);
  });
  
  app.get("/imports", requireRoles(["admin", "manager"]), listResource("import_batches", "created_at", false));
  
  app.post("/imports/:id/rollback", requireRoles(["admin", "manager"]), async (context: any) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const input = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(await context.req.json());
    const { data, error } = await context.get("db").rpc("rollback_import_batch", { p_batch_id: id, p_reason: input.reason, p_request_id: context.get("requestId") });
    return databaseResult(context, data, error);
  });
  
  // Workbook imports use one sheet per entity. The aliases intentionally match
  // the labels used by Brazilian spreadsheets as well as the database fields.
  const workbookEntities = {
    units: { table: "units", required: ["name"], fields: ["name", "phone", "active", "address"] },
    rooms: { table: "rooms", required: ["name", "unit_id"], fields: ["name", "unit_id", "capacity", "active"] },
    professionals: { table: "professionals", required: ["name", "unit_id"], fields: ["name", "council", "specialty", "active"] },
    services: { table: "services", required: ["name", "duration_minutes", "price_cents"], fields: ["name", "duration_minutes", "price_cents", "color", "active"] },
    plans: { table: "plans", required: ["name", "kind", "price_cents"], fields: ["name", "kind", "sessions_included", "duration_days", "price_cents", "active"] },
    patients: { table: "patients", required: ["name", "unit_id"], fields: ["name", "cpf", "birth_date", "phone", "email", "notes", "external_id"] },
    enrollments: { table: "enrollments", required: ["patient_id", "plan_id", "unit_id", "starts_at"], fields: ["patient_id", "plan_id", "unit_id", "starts_at", "ends_at", "due_day", "discount_cents", "surcharge_cents", "status"] },
    appointments: { table: "appointments", required: ["unit_id", "starts_at", "ends_at"], fields: ["unit_id", "patient_id", "professional_id", "service_id", "room_id", "enrollment_id", "starts_at", "ends_at", "status", "notes"] },
    group_slots: { table: "group_slots", required: ["unit_id", "room_id", "professional_id", "service_id", "name", "weekdays", "starts_at", "duration_minutes"], fields: ["unit_id", "room_id", "professional_id", "service_id", "name", "weekdays", "starts_at", "starts_on", "ends_on", "duration_minutes", "capacity", "active"] },
    charges: { table: "charges", required: ["patient_id", "unit_id", "description", "amount_cents", "due_at"], fields: ["patient_id", "enrollment_id", "unit_id", "description", "amount_cents", "due_at", "installment_number", "installment_count", "status"] },
    payments: { table: "payments", required: ["charge_id", "amount_cents", "method", "paid_at"], fields: ["charge_id", "amount_cents", "method", "paid_at", "reversed_at", "receipt_path"] },
    financial_entries: { table: "financial_entries", required: ["unit_id", "kind", "description", "category", "amount_cents", "competence_date"], fields: ["unit_id", "charge_id", "payment_id", "kind", "description", "category", "cost_center", "amount_cents", "competence_date", "settled_at"] },
    commissions: { table: "commissions", required: ["unit_id", "professional_id", "amount_cents", "basis"], fields: ["unit_id", "professional_id", "appointment_id", "payment_id", "amount_cents", "basis", "status"] },
    clinical_records: { table: "clinical_records", required: ["patient_id", "professional_id", "unit_id", "kind", "payload"], fields: ["patient_id", "appointment_id", "professional_id", "unit_id", "kind", "template_id", "template_version", "payload", "status"] },
    record_templates: { table: "record_templates", required: ["name", "kind"], fields: ["name", "kind", "specialty", "schema", "active"] },
  } as const;
  
  type WorkbookEntity = keyof typeof workbookEntities;
  const workbookAliases: Record<string, string> = {
    unidade: "unit_id", unidade_id: "unit_id", unidade_de_destino: "unit_id", sala: "room_id", sala_id: "room_id",
    profissional: "professional_id", profissional_id: "professional_id", paciente: "patient_id", paciente_id: "patient_id",
    servico: "service_id", servico_id: "service_id", plano: "plan_id", plano_id: "plan_id", matricula: "enrollment_id",
    data_nascimento: "birth_date", nascimento: "birth_date", telefone: "phone", observacoes: "notes", valor: "amount_cents",
    preco: "price_cents", duracao: "duration_minutes", data_inicio: "starts_at", inicio: "starts_at", data_fim: "ends_at",
    fim: "ends_at", vencimento: "due_at", categoria_financeira: "category", data_competencia: "competence_date",
    grupo: "group_slot_id", grupo_id: "group_slot_id", forma_pagamento: "method", pagamento: "payment_id",
  };
  
  function workbookKey(value: unknown) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }
  
  function workbookNumber(value: unknown, cents = false) {
    const number = Number(String(value ?? "").replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", "."));
    return cents && Number.isFinite(number) && number < 100000 ? Math.round(number * 100) : number;
  }
  
  async function resolveWorkbookReferences(db: any, clinicId: string, entity: WorkbookEntity, row: Record<string, unknown>) {
    const references: Record<string, [string, string]> = {
      unit_id: ["units", "name"], patient_id: ["patients", "name"], professional_id: ["professionals", "name"],
      service_id: ["services", "name"], plan_id: ["plans", "name"], room_id: ["rooms", "name"], enrollment_id: ["enrollments", "id"],
    };
    for (const [field, [table, label]] of Object.entries(references)) {
      if (!row[field] || /^[0-9a-f-]{36}$/i.test(String(row[field]))) continue;
      let query = db.from(table).select("id").eq("clinic_id", clinicId);
      query = label === "id" ? query.eq("id", row[field]) : query.ilike(label, String(row[field]));
      const { data } = await query.limit(1).maybeSingle();
      if (data?.id) row[field] = data.id;
    }
    return row;
  }
  
  app.post("/imports/workbook", requireRoles(["admin", "manager"]), async (context: any) => {
    const key = requireIdempotency(context);
    const input = z.object({ filename: z.string().min(1).max(240), dryRun: z.boolean().default(true), sheets: z.array(z.object({
      name: z.string().min(1).max(120), entity: z.string(), rows: z.array(z.record(z.unknown())).max(5000),
    })).min(1).max(30) }).parse(await context.req.json());
    const db = context.get("db"); const clinicId = context.get("profile").clinic_id;
    const issues: Array<{ sheet: string; row: number; reason: string }> = []; const prepared: Array<{ entity: WorkbookEntity; values: Record<string, unknown>; sheet: string; row: number }> = [];
    for (const sheet of input.sheets) {
      if (!(sheet.entity in workbookEntities)) { issues.push({ sheet: sheet.name, row: 0, reason: `A entidade “${sheet.entity}” não é suportada.` }); continue; }
      const entity = sheet.entity as WorkbookEntity; const config = workbookEntities[entity];
      for (const [index, raw] of sheet.rows.entries()) {
        const canonical = Object.fromEntries(Object.entries(raw).map(([key, value]) => [workbookAliases[workbookKey(key)] ?? workbookKey(key), value]));
        const values: Record<string, unknown> = {};
        for (const field of config.fields) if (canonical[field] !== undefined && canonical[field] !== "") values[field] = canonical[field];
        if (entity === "patients" && values.unit_id === undefined) values.unit_id = input.sheets.find((candidate) => candidate.entity === "units")?.rows[0]?.name;
        if (["services", "plans", "charges", "financial_entries"].includes(entity)) {
          for (const field of ["price_cents", "amount_cents", "discount_cents", "surcharge_cents"]) if (values[field] !== undefined) values[field] = workbookNumber(values[field], field.endsWith("cents"));
        }
        if (values.duration_minutes !== undefined) values.duration_minutes = workbookNumber(values.duration_minutes);
        if (values.sessions_included !== undefined) values.sessions_included = workbookNumber(values.sessions_included);
        if (values.capacity !== undefined) values.capacity = workbookNumber(values.capacity);
        if (values.weekdays && typeof values.weekdays === "string") values.weekdays = String(values.weekdays).split(/[;,|]/).map((day) => Number(day.trim())).filter((day) => Number.isInteger(day));
        if (values.schema && typeof values.schema === "string") { try { values.schema = JSON.parse(values.schema); } catch { values.schema = {}; } }
        if (values.payload && typeof values.payload === "string") { try { values.payload = JSON.parse(values.payload); } catch { values.payload = { text: values.payload }; } }
        if (values.address && typeof values.address === "string") values.address = { street: values.address };
        await resolveWorkbookReferences(db, clinicId, entity, values);
        for (const required of config.required) if (values[required] === undefined || values[required] === "") issues.push({ sheet: sheet.name, row: index + 2, reason: `Campo obrigatório ausente: ${required}` });
        if (entity === "patients" && values.unit_id && !/^[0-9a-f-]{36}$/i.test(String(values.unit_id))) issues.push({ sheet: sheet.name, row: index + 2, reason: `Unidade não encontrada: ${values.unit_id}` });
        prepared.push({ entity, values, sheet: sheet.name, row: index + 2 });
      }
    }
    if (input.dryRun) return ok(context, { dryRun: true, total: prepared.length, accepted: prepared.filter((item) => !issues.some((issue) => issue.sheet === item.sheet && issue.row === item.row)).length, issues });
    const valid = prepared.filter((item) => !issues.some((issue) => issue.sheet === item.sheet && issue.row === item.row));
    const entityOrder = Object.keys(workbookEntities) as WorkbookEntity[];
    const rows = [...valid].sort((left, right) => entityOrder.indexOf(left.entity) - entityOrder.indexOf(right.entity)).map((item) => {
      const values = { ...item.values };
      const unitId = item.entity === "professionals" ? String(values.unit_id ?? "") : undefined;
      if (item.entity === "professionals") delete values.unit_id;
      if (item.entity === "patients") {
        values.primary_unit_id = values.unit_id;
        delete values.unit_id;
        values.migration_source = "manual";
      }
      if (item.entity === "payments") values.idempotency_key = `${key}-${item.sheet}-${item.row}`;
      return {
        entity: item.entity,
        external_id: `${item.sheet}:${item.row}`,
        payload: item.values,
        values,
        ...(unitId ? { unit_id: unitId } : {}),
      };
    });
    const { data, error } = await db.rpc("import_rows_transactional", {
      p_source: "manual",
      p_filename: input.filename,
      p_unit_id: null,
      p_rows: rows,
      p_mapping: { sheets: input.sheets.map((sheet) => ({ name: sheet.name, entity: sheet.entity })) },
      p_issues: issues,
      p_idempotency_key: key,
      p_request_id: context.get("requestId"),
    });
    return transactionalImportResult(context, data, error);
  });
  
  const notionSources = {
    professionals: "2ffff160-df01-81dd-bec9-000bb99f953b",
    insurance_providers: "2ffff160-df01-81ff-afcf-000b7f66b9dc",
    lead_sources: "2ffff160-df01-8166-bfd5-000b3fdc3e09",
    financial_categories: "2ffff160-df01-81ac-98f6-000b680d1941",
    message_templates: "2ffff160-df01-81de-9beb-000b32d4c390",
    documents: "2ffff160-df01-818e-b28a-000bffc74584",
    patients: "2ffff160-df01-81aa-8191-000b099bfc19",
    appointments: "2ffff160-df01-81d0-8764-000bb05b1e92",
    enrollments: "2ffff160-df01-81c2-a005-000bc3907333",
    financial_entries: "2ffff160-df01-81d5-b37c-000bcb1c1294",
    prospects: "2ffff160-df01-8195-9368-000b90930839",
  } as const;
  
  app.post("/imports/notion", requireRoles(["admin", "manager"]), async (context: any) => {
    const key = requireIdempotency(context);
    const input = z.object({
      unit_id: z.string().uuid(),
      dryRun: z.boolean().default(true),
    }).parse(await context.req.json());
    const db = context.get("db");
    const clinicId = context.get("profile").clinic_id;
    const { data: unit, error: unitError } = await db.from("units").select("id,name")
      .eq("id", input.unit_id).eq("clinic_id", clinicId).is("deleted_at", null).single();
    if (unitError || !unit) return fail(context, 404, "UNIT_NOT_FOUND", "A unidade de destino não foi encontrada.");
  
    const token = requiredEnv("NOTION_TOKEN");
    const inventories: Record<string, NotionPage[]> = {};
    for (const [entityType, sourceId] of Object.entries(notionSources)) {
      inventories[entityType] = await notionQueryAll(token, sourceId);
    }
  
    const issues = validateNotionInventory(inventories);
    const counts = Object.fromEntries(Object.entries(inventories).map(([name, rows]) => [name, rows.length]));
    if (input.dryRun) {
      await audit(context, "import.notion.validated", "import_batch", null, input.unit_id, {
        sourcePageId: "2ffff160-df01-81c0-b764-e4345252868f", counts, issueCount: issues.length,
      });
      return ok(context, { dryRun: true, unit, counts, issues, total: Object.values(counts).reduce((a, b) => a + b, 0) });
    }
  
    const { rows, issues: importIssues } = prepareNotionImport(inventories, input.unit_id, issues);
    const { data, error } = await db.rpc("import_rows_transactional", {
      p_source: "notion",
      p_filename: "[Oluma] Fisiofit Unidade I (API)",
      p_unit_id: input.unit_id,
      p_rows: rows,
      p_mapping: {
        unit_id: input.unit_id,
        unit_name: unit.name,
        source_page_id: "2ffff160-df01-81c0-b764-e4345252868f",
        sources: notionSources,
        counts,
      },
      p_issues: importIssues,
      p_idempotency_key: key,
      p_request_id: context.get("requestId"),
    });
    return transactionalImportResult(context, data, error, { unit, counts });
  });
  
  app.post("/imports/patients", requireRoles(["admin", "manager"]), async (context: any) => {
    const key = requireIdempotency(context);
    const input = z.object({
      source: z.enum(["oluma", "notion", "manual"]),
      filename: z.string().min(1).max(240),
      unit_id: z.string().uuid(),
      dryRun: z.boolean().default(true),
      rows: z.array(z.object({
        external_id: z.string().max(120).optional(),
        name: z.string().trim().min(3).max(160),
        cpf: z.string().trim().min(11).max(14).optional(),
        birth_date: z.string().date().optional(),
        phone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        notes: z.string().max(4000).optional(),
      })).min(1).max(2000),
    }).parse(await context.req.json());
    const db = context.get("db");
    const cpfs = input.rows.flatMap((row) => row.cpf ? [row.cpf] : []);
    const { data: existing, error: existingError } = cpfs.length
      ? await db.from("patients").select("cpf").eq("clinic_id", context.get("profile").clinic_id).in("cpf", cpfs).is("deleted_at", null)
      : { data: [], error: null };
    if (existingError) return databaseResult(context, null, existingError);
    const existingCpfs = new Set((existing ?? []).map((row) => row.cpf));
    const seenCpfs = new Set<string>();
    const rejected: Array<{ row: number; reason: string }> = [];
    const accepted = input.rows.filter((row, index) => {
      if (row.cpf && (existingCpfs.has(row.cpf) || seenCpfs.has(row.cpf))) {
        rejected.push({ row: index + 2, reason: "CPF duplicado" });
        return false;
      }
      if (row.cpf) seenCpfs.add(row.cpf);
      return true;
    });
    if (input.dryRun) return ok(context, { accepted: accepted.length, rejected, total: input.rows.length });
  
    const rows = accepted.map((row, index) => ({
      entity: "patients",
      external_id: row.external_id ?? `${key}:${index + 2}`,
      payload: row,
      values: {
        ...row,
        primary_unit_id: input.unit_id,
        migration_source: input.source,
      },
    }));
    const { data, error } = await db.rpc("import_rows_transactional", {
      p_source: input.source,
      p_filename: input.filename,
      p_unit_id: input.unit_id,
      p_rows: rows,
      p_mapping: {},
      p_issues: rejected,
      p_idempotency_key: key,
      p_request_id: context.get("requestId"),
    });
    return transactionalImportResult(context, data, error, { rejected });
  });
}
