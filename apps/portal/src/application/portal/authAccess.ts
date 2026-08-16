export type AccessFailure =
  | "session-expired"
  | "bootstrap"
  | "membership"
  | "unavailable";

type AuthRequestError = {
  code?: string;
  message?: string;
  status?: number;
};

type ApiRequestError = Error & {
  apiError?: { code?: string };
  status?: number;
};

const membershipCodes = new Set([
  "MEMBERSHIP_INACTIVE",
  "MEMBERSHIP_INVITED",
  "MEMBERSHIP_BLOCKED",
  "MEMBERSHIP_NOT_FOUND",
]);

export const sessionExpiredNoticeKey = "fisiofit:session-expired-notice";
export const sessionExpiredNotice =
  "Sua sessão expirou por segurança. Entre novamente com seu e-mail e senha.";

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function loginErrorMessage(error: unknown) {
  const authError = error as AuthRequestError;
  const code = authError?.code ?? "";
  const message = authError?.message?.toLowerCase() ?? "";

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Abra o link de acesso enviado para sua caixa de entrada.";
  }
  if (code === "user_banned" || message.includes("banned")) {
    return "Esta conta está bloqueada. Fale com a administradora.";
  }
  if (
    authError?.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (
    authError?.status === 0 ||
    code === "request_timeout" ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return "Não foi possível conectar ao serviço de acesso. Verifique sua internet e tente novamente.";
  }
  return "E-mail ou senha inválidos. Confira os dados ou solicite um novo link de acesso.";
}

export function recoveryErrorMessage(error: unknown) {
  const authError = error as AuthRequestError;
  const code = authError?.code ?? "";
  const message = authError?.message?.toLowerCase() ?? "";

  if (
    authError?.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Muitos links foram solicitados em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (
    authError?.status === 0 ||
    code === "request_timeout" ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return "Não foi possível conectar ao serviço de acesso. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível enviar o link agora. Confira o e-mail e tente novamente em instantes.";
}

export function classifyAccessFailure(error: unknown): AccessFailure {
  const requestError = error as ApiRequestError;
  const code = requestError?.apiError?.code;

  if (code === "BOOTSTRAP_REQUIRED") return "bootstrap";
  if (code === "UNAUTHENTICATED" || requestError?.status === 401) {
    return "session-expired";
  }
  if (code && membershipCodes.has(code)) return "membership";
  return "unavailable";
}
