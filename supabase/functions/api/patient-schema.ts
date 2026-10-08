import { z } from "npm:zod@3.24.2";

// null clears an optional field; an omitted field is preserved by PATCH.
const optionalText = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value,
  schema.nullable().optional(),
);
export const patientSchema = z.object({
  primary_unit_id: z.string().uuid("Selecione uma unidade válida."),
  name: z.string().trim().min(3, "Informe o nome completo com ao menos 3 caracteres.").max(160, "O nome deve ter até 160 caracteres."),
  cpf: optionalText(z.string().min(11, "Informe o CPF com 11 dígitos, com ou sem pontuação.").max(14, "O CPF deve ter até 14 caracteres.")),
  birth_date: optionalText(z.string().date("Informe uma data de nascimento válida.")),
  phone: optionalText(z.string().max(20, "O telefone deve ter até 20 caracteres.")),
  email: optionalText(z.string().email("Informe um e-mail válido.")),
  address: z.record(z.string()).optional(),
  tax_data: z.record(z.unknown()).optional(),
  notes: optionalText(z.string().max(4000, "As observações devem ter até 4000 caracteres.")),
});
