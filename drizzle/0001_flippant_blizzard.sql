PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`patient_id` text,
	`professional_id` text,
	`service_id` text,
	`room_id` text,
	`enrollment_id` text,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`recurrence_id` text,
	`status` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`professional_id`) REFERENCES `professionals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "unit_id", "patient_id", "professional_id", "service_id", "room_id", "enrollment_id", "starts_at", "ends_at", "recurrence_id", "status", "notes", "created_at", "updated_at", "deleted_at") SELECT "id", "unit_id", "patient_id", "professional_id", "service_id", "room_id", "enrollment_id", "starts_at", "ends_at", "recurrence_id", "status", "notes", "created_at", "updated_at", "deleted_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `appointments_professional_time_idx` ON `appointments` (`professional_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `appointments_room_time_idx` ON `appointments` (`room_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "clinic_id", "patient_id", "storage_key", "filename", "content_type", "size_bytes", "uploaded_by", "created_at", "updated_at", "deleted_at") SELECT "id", "clinic_id", "patient_id", "storage_key", "filename", "content_type", "size_bytes", "uploaded_by", "created_at", "updated_at", "deleted_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
CREATE TABLE `__new_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`unit_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audit_events`("id", "clinic_id", "user_id", "unit_id", "action", "entity_type", "entity_id", "metadata", "occurred_at") SELECT "id", "clinic_id", "user_id", "unit_id", "action", "entity_type", "entity_id", "metadata", "occurred_at" FROM `audit_events`;--> statement-breakpoint
DROP TABLE `audit_events`;--> statement-breakpoint
ALTER TABLE `__new_audit_events` RENAME TO `audit_events`;--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `__new_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`enrollment_id` text,
	`unit_id` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_charges`("id", "patient_id", "enrollment_id", "unit_id", "description", "amount_cents", "paid_cents", "due_at", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "patient_id", "enrollment_id", "unit_id", "description", "amount_cents", "paid_cents", "due_at", "status", "created_at", "updated_at", "deleted_at" FROM `charges`;--> statement-breakpoint
DROP TABLE `charges`;--> statement-breakpoint
ALTER TABLE `__new_charges` RENAME TO `charges`;--> statement-breakpoint
CREATE TABLE `__new_clinical_records` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`professional_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`kind` text NOT NULL,
	`template_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`signed_at` text,
	`signature_hash` text,
	`rectifies_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`professional_id`) REFERENCES `professionals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_clinical_records`("id", "patient_id", "appointment_id", "professional_id", "unit_id", "kind", "template_id", "payload", "status", "signed_at", "signature_hash", "rectifies_id", "created_at", "updated_at", "deleted_at") SELECT "id", "patient_id", "appointment_id", "professional_id", "unit_id", "kind", "template_id", "payload", "status", "signed_at", "signature_hash", "rectifies_id", "created_at", "updated_at", "deleted_at" FROM `clinical_records`;--> statement-breakpoint
DROP TABLE `clinical_records`;--> statement-breakpoint
ALTER TABLE `__new_clinical_records` RENAME TO `clinical_records`;--> statement-breakpoint
CREATE INDEX `records_patient_idx` ON `clinical_records` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_clinics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`document` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_clinics`("id", "name", "document", "created_at", "updated_at", "deleted_at") SELECT "id", "name", "document", "created_at", "updated_at", "deleted_at" FROM `clinics`;--> statement-breakpoint
DROP TABLE `clinics`;--> statement-breakpoint
ALTER TABLE `__new_clinics` RENAME TO `clinics`;--> statement-breakpoint
CREATE TABLE `__new_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`granted` integer NOT NULL,
	`granted_at` text,
	`revoked_at` text,
	`evidence_attachment_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_consents`("id", "patient_id", "kind", "granted", "granted_at", "revoked_at", "evidence_attachment_id", "created_at", "updated_at", "deleted_at") SELECT "id", "patient_id", "kind", "granted", "granted_at", "revoked_at", "evidence_attachment_id", "created_at", "updated_at", "deleted_at" FROM `consents`;--> statement-breakpoint
DROP TABLE `consents`;--> statement-breakpoint
ALTER TABLE `__new_consents` RENAME TO `consents`;--> statement-breakpoint
CREATE TABLE `__new_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`due_day` integer,
	`sessions_used` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`surcharge_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_enrollments`("id", "patient_id", "plan_id", "unit_id", "starts_at", "ends_at", "due_day", "sessions_used", "discount_cents", "surcharge_cents", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "patient_id", "plan_id", "unit_id", "starts_at", "ends_at", "due_day", "sessions_used", "discount_cents", "surcharge_cents", "status", "created_at", "updated_at", "deleted_at" FROM `enrollments`;--> statement-breakpoint
DROP TABLE `enrollments`;--> statement-breakpoint
ALTER TABLE `__new_enrollments` RENAME TO `enrollments`;--> statement-breakpoint
CREATE TABLE `__new_financial_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`charge_id` text,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`cost_center` text,
	`amount_cents` integer NOT NULL,
	`competence_date` text NOT NULL,
	`settled_at` text,
	`recurrence_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_financial_entries`("id", "unit_id", "charge_id", "kind", "description", "category", "cost_center", "amount_cents", "competence_date", "settled_at", "recurrence_id", "created_at", "updated_at", "deleted_at") SELECT "id", "unit_id", "charge_id", "kind", "description", "category", "cost_center", "amount_cents", "competence_date", "settled_at", "recurrence_id", "created_at", "updated_at", "deleted_at" FROM `financial_entries`;--> statement-breakpoint
DROP TABLE `financial_entries`;--> statement-breakpoint
ALTER TABLE `__new_financial_entries` RENAME TO `financial_entries`;--> statement-breakpoint
CREATE INDEX `financial_unit_competence_idx` ON `financial_entries` (`unit_id`,`competence_date`);--> statement-breakpoint
CREATE TABLE `__new_fiscal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`provider` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_id` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_fiscal_documents`("id", "payment_id", "provider", "status", "external_id", "error_message", "created_at", "updated_at", "deleted_at") SELECT "id", "payment_id", "provider", "status", "external_id", "error_message", "created_at", "updated_at", "deleted_at" FROM `fiscal_documents`;--> statement-breakpoint
DROP TABLE `fiscal_documents`;--> statement-breakpoint
ALTER TABLE `__new_fiscal_documents` RENAME TO `fiscal_documents`;--> statement-breakpoint
CREATE TABLE `__new_patients` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`primary_unit_id` text NOT NULL,
	`name` text NOT NULL,
	`cpf` text,
	`birth_date` text,
	`phone` text,
	`email` text,
	`address` text,
	`tax_data` text,
	`notes` text,
	`migration_source` text,
	`external_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_patients`("id", "clinic_id", "primary_unit_id", "name", "cpf", "birth_date", "phone", "email", "address", "tax_data", "notes", "migration_source", "external_id", "created_at", "updated_at", "deleted_at") SELECT "id", "clinic_id", "primary_unit_id", "name", "cpf", "birth_date", "phone", "email", "address", "tax_data", "notes", "migration_source", "external_id", "created_at", "updated_at", "deleted_at" FROM `patients`;--> statement-breakpoint
DROP TABLE `patients`;--> statement-breakpoint
ALTER TABLE `__new_patients` RENAME TO `patients`;--> statement-breakpoint
CREATE INDEX `patients_clinic_name_idx` ON `patients` (`clinic_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_clinic_cpf_unique` ON `patients` (`clinic_id`,`cpf`);--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`charge_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`paid_at` text NOT NULL,
	`reversed_at` text,
	`receipt_attachment_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "charge_id", "amount_cents", "method", "paid_at", "reversed_at", "receipt_attachment_id", "created_at", "updated_at", "deleted_at") SELECT "id", "charge_id", "amount_cents", "method", "paid_at", "reversed_at", "receipt_attachment_id", "created_at", "updated_at", "deleted_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
CREATE TABLE `__new_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sessions_included` integer,
	`duration_days` integer,
	`price_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_plans`("id", "clinic_id", "name", "kind", "sessions_included", "duration_days", "price_cents", "created_at", "updated_at", "deleted_at") SELECT "id", "clinic_id", "name", "kind", "sessions_included", "duration_days", "price_cents", "created_at", "updated_at", "deleted_at" FROM `plans`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
ALTER TABLE `__new_plans` RENAME TO `plans`;--> statement-breakpoint
CREATE TABLE `__new_professionals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`clinic_id` text NOT NULL,
	`council` text,
	`specialty` text,
	`commission_type` text,
	`commission_value` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_professionals`("id", "user_id", "clinic_id", "council", "specialty", "commission_type", "commission_value", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "clinic_id", "council", "specialty", "commission_type", "commission_value", "created_at", "updated_at", "deleted_at" FROM `professionals`;--> statement-breakpoint
DROP TABLE `professionals`;--> statement-breakpoint
ALTER TABLE `__new_professionals` RENAME TO `professionals`;--> statement-breakpoint
CREATE TABLE `__new_services` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`color` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_services`("id", "clinic_id", "name", "duration_minutes", "price_cents", "color", "created_at", "updated_at", "deleted_at") SELECT "id", "clinic_id", "name", "duration_minutes", "price_cents", "color", "created_at", "updated_at", "deleted_at" FROM `services`;--> statement-breakpoint
DROP TABLE `services`;--> statement-breakpoint
ALTER TABLE `__new_services` RENAME TO `services`;--> statement-breakpoint
CREATE TABLE `__new_units` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_units`("id", "clinic_id", "name", "address", "timezone", "created_at", "updated_at", "deleted_at") SELECT "id", "clinic_id", "name", "address", "timezone", "created_at", "updated_at", "deleted_at" FROM `units`;--> statement-breakpoint
DROP TABLE `units`;--> statement-breakpoint
ALTER TABLE `__new_units` RENAME TO `units`;--> statement-breakpoint
CREATE INDEX `units_clinic_idx` ON `units` (`clinic_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "role", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "email", "name", "role", "status", "created_at", "updated_at", "deleted_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);