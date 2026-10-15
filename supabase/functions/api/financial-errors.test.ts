import { financialError } from "./financial-errors.ts";
const expected: Record<string, [number, string]> = {
  CONTRACT_HAS_FUTURE_CHARGES: [409, "Cobrança futura incompatível"],
  ENROLLMENT_NOT_ACTIVE: [409, "Matrícula inativa"],
  CONTRACT_AMOUNT_CONFLICT: [409, "Contrato alterado por outro usuário"],
  AMOUNT_BELOW_RECEIVED: [409, "menor que o valor recebido"],
  PLAN_CHANGE_FUTURE_RECEIPTS: [409, "paga ou parcial"],
};
for (const [code, [status, message]] of Object.entries(expected)) {
  Deno.test(`financial API error ${code}`, () => {
    const result = financialError(code);
    if (result?.status !== status || result.code !== code || !result.message.includes(message)) throw new Error(`Missing actionable error: ${code}`);
  });
}
Deno.test("unknown database exceptions remain generic", () => {
  if (financialError("secret internal database diagnostic") !== null) throw new Error("Internal diagnostic leaked");
});
