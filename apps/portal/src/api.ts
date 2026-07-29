import type { ApiEnvelope, ApiError, Paginated } from "@fisiofit/contracts";
import { supabase } from "./supabase";

const apiBase = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/api/v1`;

export async function api<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<ApiEnvelope<T>> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${apiBase}${path}`, {
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
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    const error = payload.error ?? {
      code: "HTTP_ERROR",
      message: "Não foi possível concluir a operação.",
    };
    throw Object.assign(new Error(error.message), { apiError: error as ApiError });
  }
  return payload;
}

export function list<T>(path: string) {
  return api<Paginated<T>>(path);
}
