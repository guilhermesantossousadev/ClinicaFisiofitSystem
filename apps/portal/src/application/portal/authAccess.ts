export type AccessFailure =
  | "session-expired"
  | "mfa"
  | "bootstrap"
  | "membership"
  | "unavailable";

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

export function classifyAccessFailure(error: unknown): AccessFailure {
  const requestError = error as ApiRequestError;
  const code = requestError?.apiError?.code;

  if (code === "MFA_REQUIRED") return "mfa";
  if (code === "BOOTSTRAP_REQUIRED") return "bootstrap";
  if (code === "UNAUTHENTICATED" || requestError?.status === 401) {
    return "session-expired";
  }
  if (code && membershipCodes.has(code)) return "membership";
  return "unavailable";
}
