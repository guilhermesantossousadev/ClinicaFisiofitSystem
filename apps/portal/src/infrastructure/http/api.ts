import type { ApiEnvelope, ApiError, Paginated } from "@fisiofit/contracts";
import { supabase } from "../supabase/client";

const apiBase = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/api/v1`;

function fallbackError(status: number): ApiError {
  return {
    code: "HTTP_ERROR",
    message:
      status === 401
        ? "Sua sessão expirou. Entre novamente."
        : "Não foi possível concluir a operação.",
  };
}

export async function api<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<ApiEnvelope<T>> {
  const interactionId = crypto.randomUUID();
  window.dispatchEvent(new CustomEvent("fisiofit:request-start", {
    detail: { id: interactionId, method: init.method ?? "GET", source: document.activeElement instanceof HTMLElement ? document.activeElement : undefined },
  }));
  const { data } = await supabase.auth.getSession();
  const selectedUnit = init.method?.toUpperCase() === "POST" || init.method?.toUpperCase() === "PATCH" ? "" : (() => {
    try { return window.localStorage.getItem("fisiofit:selected-unit") ?? ""; } catch { return ""; }
  })();
  const requestPath = selectedUnit && (init.method ?? "GET").toUpperCase() === "GET" && !path.includes("unitId=") && path !== "/units"
    ? `${path}${path.includes("?") ? "&" : "?"}unitId=${encodeURIComponent(selectedUnit)}`
    : path;
  let response: Response;
  try {
    response = await fetch(`${apiBase}${requestPath}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(data.session?.access_token
          ? { authorization: `Bearer ${data.session.access_token}` }
          : {}),
        ...(init.idempotencyKey
          ? { "idempotency-key": init.idempotencyKey }
          : {}),
        ...init.headers,
      },
    });
  } catch {
    const error: ApiError = {
      code: "NETWORK_ERROR",
      message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    };
    window.dispatchEvent(
      new CustomEvent("fisiofit:api-error", { detail: { message: error.message } }),
    );
    window.dispatchEvent(new CustomEvent("fisiofit:request-end", {
      detail: { id: interactionId, ok: false },
    }));
    throw Object.assign(new Error(error.message), { apiError: error });
  }
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiEnvelope<T>)
    : ({ data: null, error: fallbackError(response.status), requestId: "" } as ApiEnvelope<T>);
  if (!response.ok) {
    const error = payload.error ?? fallbackError(response.status);
    window.dispatchEvent(
      new CustomEvent("fisiofit:api-error", { detail: { message: error.message } }),
    );
    window.dispatchEvent(new CustomEvent("fisiofit:request-end", {
      detail: { id: interactionId, ok: false },
    }));
    throw Object.assign(new Error(error.message), { apiError: error as ApiError });
  }
  window.dispatchEvent(new CustomEvent("fisiofit:request-end", {
    detail: { id: interactionId, ok: true },
  }));
  return payload;
}

export function list<T>(path: string) {
  return api<Paginated<T>>(path);
}
