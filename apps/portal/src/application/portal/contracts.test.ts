import { describe, expect, it } from "vitest";
import {
  appointmentInputSchema,
  groupSlotInputSchema,
  paymentInputSchema,
  dataSubjectRequestInputSchema,
} from "@fisiofit/contracts";
import {
  classifyAccessFailure,
  loginErrorMessage,
  normalizeLoginEmail,
  recoveryErrorMessage,
} from "./authAccess";

const ids = {
  unitId: "2a0afc6d-9c33-4e1a-b6ce-13fb448f8160",
  roomId: "4a8ca879-28bb-43a4-9618-f50ac218b1e8",
  professionalId: "94d94ce2-bc4a-4c52-b5dc-90d1551bba5e",
  serviceId: "a41a6bcb-d697-44bc-8dcb-4df9388ccbc1",
};

describe("contratos da agenda", () => {
  it("usa capacidade sete como padrão das turmas", () => {
    const slot = groupSlotInputSchema.parse({
      ...ids,
      name: "Segunda e quarta às 09:00",
      weekdays: [1, 3],
      startsAt: "09:00",
      durationMinutes: 50,
    });
    expect(slot.capacity).toBe(7);
  });

  it("rejeita turmas acima de sete alunos", () => {
    expect(() => groupSlotInputSchema.parse({
      ...ids,
      name: "Terça e quinta às 09:00",
      weekdays: [2, 4],
      startsAt: "09:00",
      durationMinutes: 50,
      capacity: 8,
    })).toThrow();
  });

  it("rejeita agendamento cujo término antecede o início", () => {
    expect(() => appointmentInputSchema.parse({
      unitId: ids.unitId,
      professionalId: ids.professionalId,
      startsAt: "2026-07-29T10:00:00-03:00",
      endsAt: "2026-07-29T09:00:00-03:00",
    })).toThrow();
  });
});

describe("contratos financeiros", () => {
  it("aceita apenas pagamentos positivos", () => {
    expect(() => paymentInputSchema.parse({
      chargeId: ids.unitId,
      amountCents: 0,
      method: "pix",
      paidAt: "2026-07-29T09:00:00-03:00",
    })).toThrow();
  });
});

describe("contratos de privacidade", () => {
  it("exige um canal de retorno para a solicitação do titular", () => {
    expect(() => dataSubjectRequestInputSchema.parse({
      requesterName: "Maria da Silva",
      kind: "access",
    })).toThrow();
  });
});

describe("fluxo de acesso", () => {
  it("normaliza o e-mail sem alterar a senha", () => {
    expect(normalizeLoginEmail("  Guilherme@Example.COM ")).toBe("guilherme@example.com");
  });

  it("diferencia indisponibilidade e limite de tentativas de senha inválida", () => {
    expect(loginErrorMessage({ status: 429, code: "over_request_rate_limit" }))
      .toContain("Muitas tentativas");
    expect(loginErrorMessage({ message: "Failed to fetch" }))
      .toContain("conectar");
    expect(loginErrorMessage({ code: "invalid_credentials" }))
      .toContain("E-mail ou senha inválidos");
  });

  it("diferencia sessão expirada de primeiro acesso", () => {
    expect(classifyAccessFailure({ apiError: { code: "UNAUTHENTICATED" }, status: 401 }))
      .toBe("session-expired");
    expect(classifyAccessFailure({ apiError: { code: "BOOTSTRAP_REQUIRED" }, status: 403 }))
      .toBe("bootstrap");
  });

  it("explica falhas de conexão e limite na recuperação de senha", () => {
    expect(recoveryErrorMessage({ message: "Failed to fetch" })).toContain("conectar");
    expect(recoveryErrorMessage({ status: 429 })).toContain("Muitos links");
  });

  it("não envia conta inativa nem falha de rede ao onboarding", () => {
    expect(classifyAccessFailure({ apiError: { code: "MEMBERSHIP_BLOCKED" }, status: 403 }))
      .toBe("membership");
    expect(classifyAccessFailure({ apiError: { code: "NETWORK_ERROR" } }))
      .toBe("unavailable");
  });
});
