import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
};

export const clinics = sqliteTable("clinics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"),
  ...timestamps,
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  name: text("name").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  ...timestamps,
}, (t) => [index("units_clinic_idx").on(t.clinicId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "manager", "reception", "professional", "finance"] }).notNull(),
  status: text("status", { enum: ["invited", "active", "blocked"] }).notNull().default("invited"),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

export const userUnits = sqliteTable("user_units", {
  userId: text("user_id").notNull().references(() => users.id),
  unitId: text("unit_id").notNull().references(() => units.id),
});

export const professionals = sqliteTable("professionals", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  council: text("council"),
  specialty: text("specialty"),
  commissionType: text("commission_type", { enum: ["percent", "fixed"] }),
  commissionValue: real("commission_value"),
  ...timestamps,
});

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  primaryUnitId: text("primary_unit_id").notNull().references(() => units.id),
  name: text("name").notNull(),
  cpf: text("cpf"),
  birthDate: text("birth_date"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  taxData: text("tax_data", { mode: "json" }),
  notes: text("notes"),
  migrationSource: text("migration_source"),
  externalId: text("external_id"),
  ...timestamps,
}, (t) => [
  index("patients_clinic_name_idx").on(t.clinicId, t.name),
  uniqueIndex("patients_clinic_cpf_unique").on(t.clinicId, t.cpf),
]);

export const consents = sqliteTable("consents", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  kind: text("kind").notNull(),
  granted: integer("granted", { mode: "boolean" }).notNull(),
  grantedAt: text("granted_at"),
  revokedAt: text("revoked_at"),
  evidenceAttachmentId: text("evidence_attachment_id"),
  ...timestamps,
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  color: text("color"),
  ...timestamps,
});

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["monthly", "package", "single"] }).notNull(),
  sessionsIncluded: integer("sessions_included"),
  durationDays: integer("duration_days"),
  priceCents: integer("price_cents").notNull(),
  ...timestamps,
});

export const enrollments = sqliteTable("enrollments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  planId: text("plan_id").notNull().references(() => plans.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  dueDay: integer("due_day"),
  sessionsUsed: integer("sessions_used").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  surchargeCents: integer("surcharge_cents").notNull().default(0),
  status: text("status", { enum: ["active", "paused", "expired", "cancelled"] }).notNull().default("active"),
  ...timestamps,
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  patientId: text("patient_id").references(() => patients.id),
  professionalId: text("professional_id").references(() => professionals.id),
  serviceId: text("service_id").references(() => services.id),
  roomId: text("room_id"),
  enrollmentId: text("enrollment_id").references(() => enrollments.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  recurrenceId: text("recurrence_id"),
  status: text("status", { enum: ["scheduled", "confirmed", "attending", "completed", "missed", "cancelled", "blocked"] }).notNull(),
  notes: text("notes"),
  ...timestamps,
}, (t) => [
  index("appointments_professional_time_idx").on(t.professionalId, t.startsAt, t.endsAt),
  index("appointments_room_time_idx").on(t.roomId, t.startsAt, t.endsAt),
]);

export const clinicalRecords = sqliteTable("clinical_records", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  professionalId: text("professional_id").notNull().references(() => professionals.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  kind: text("kind", { enum: ["assessment", "evolution", "rectification"] }).notNull(),
  templateId: text("template_id"),
  payload: text("payload", { mode: "json" }).notNull(),
  status: text("status", { enum: ["draft", "signed"] }).notNull().default("draft"),
  signedAt: text("signed_at"),
  signatureHash: text("signature_hash"),
  rectifiesId: text("rectifies_id"),
  ...timestamps,
}, (t) => [index("records_patient_idx").on(t.patientId, t.createdAt)]);

export const charges = sqliteTable("charges", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  enrollmentId: text("enrollment_id").references(() => enrollments.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  dueAt: text("due_at").notNull(),
  status: text("status", { enum: ["pending", "partial", "paid", "overdue", "cancelled"] }).notNull(),
  ...timestamps,
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  chargeId: text("charge_id").notNull().references(() => charges.id),
  amountCents: integer("amount_cents").notNull(),
  method: text("method", { enum: ["pix", "card", "cash", "transfer"] }).notNull(),
  paidAt: text("paid_at").notNull(),
  reversedAt: text("reversed_at"),
  receiptAttachmentId: text("receipt_attachment_id"),
  ...timestamps,
});

export const financialEntries = sqliteTable("financial_entries", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  chargeId: text("charge_id").references(() => charges.id),
  kind: text("kind", { enum: ["income", "expense"] }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  costCenter: text("cost_center"),
  amountCents: integer("amount_cents").notNull(),
  competenceDate: text("competence_date").notNull(),
  settledAt: text("settled_at"),
  recurrenceId: text("recurrence_id"),
  ...timestamps,
}, (t) => [index("financial_unit_competence_idx").on(t.unitId, t.competenceDate)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  patientId: text("patient_id").references(() => patients.id),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  ...timestamps,
});

export const fiscalDocuments = sqliteTable("fiscal_documents", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").notNull().references(() => payments.id),
  provider: text("provider"),
  status: text("status", { enum: ["pending", "processing", "issued", "cancelled", "error"] }).notNull().default("pending"),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull().references(() => clinics.id),
  userId: text("user_id").notNull().references(() => users.id),
  unitId: text("unit_id").references(() => units.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata", { mode: "json" }),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("audit_entity_idx").on(t.entityType, t.entityId, t.occurredAt)]);
