import { z } from "zod";

export type Role = "admin" | "manager" | "reception" | "professional" | "finance";
export type ApiError = { code: string; message: string; details?: unknown };
export type ApiEnvelope<T> = {
  data: T | null;
  error: ApiError | null;
  requestId: string;
  meta?: { page?: number; pageSize?: number; total?: number };
};
export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

export const uuidSchema = z.string().uuid();
export const moneySchema = z.number().int().nonnegative();
export const isoDateSchema = z.string().datetime({ offset: true });

export const patientInputSchema = z.object({
  unitId: uuidSchema,
  name: z.string().trim().min(3).max(160),
  cpf: z.string().trim().min(11).max(14).optional(),
  birthDate: z.string().date().optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  email: z.string().email().optional(),
  address: z.record(z.string()).optional(),
  notes: z.string().max(4000).optional(),
});

export const appointmentInputSchema = z.object({
  unitId: uuidSchema,
  patientId: uuidSchema.optional(),
  professionalId: uuidSchema,
  serviceId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  enrollmentId: uuidSchema.optional(),
  groupSlotId: uuidSchema.optional(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
  recurrence: z.object({
    frequency: z.enum(["weekly", "biweekly", "monthly"]),
    count: z.number().int().min(2).max(104),
  }).optional(),
  notes: z.string().max(1000).optional(),
}).refine((value) => value.endsAt > value.startsAt, {
  message: "O término deve ocorrer depois do início",
  path: ["endsAt"],
});

export const groupSlotInputSchema = z.object({
  unitId: uuidSchema,
  roomId: uuidSchema,
  professionalId: uuidSchema,
  serviceId: uuidSchema,
  name: z.string().trim().min(3).max(100),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  durationMinutes: z.number().int().min(15).max(240),
  capacity: z.number().int().min(3).max(7).default(7),
});

export const paymentInputSchema = z.object({
  chargeId: uuidSchema,
  amountCents: moneySchema.positive(),
  method: z.enum(["pix", "card", "cash", "transfer"]),
  paidAt: isoDateSchema,
});

export const clinicalRecordInputSchema = z.object({
  patientId: uuidSchema,
  appointmentId: uuidSchema.optional(),
  unitId: uuidSchema,
  kind: z.enum(["assessment", "evolution"]),
  templateId: uuidSchema.optional(),
  payload: z.record(z.unknown()),
});
