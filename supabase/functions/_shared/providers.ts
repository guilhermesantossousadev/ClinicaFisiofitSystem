export type ProviderResult<T> =
  | { ok: true; data: T; externalId?: string }
  | { ok: false; retryable: boolean; code: string; message: string };

export interface FiscalProvider {
  issue(input: {
    paymentId: string;
    customer: { name: string; document?: string; email?: string };
    service: { description: string; amountCents: number };
  }): Promise<ProviderResult<{ documentNumber: string; pdfUrl?: string }>>;
  cancel(externalId: string, reason: string): Promise<ProviderResult<void>>;
  status(externalId: string): Promise<ProviderResult<{ status: "processing" | "issued" | "cancelled" | "error" }>>;
}

export interface MessagingProvider {
  send(input: {
    to: string;
    template: string;
    variables: Record<string, string>;
    idempotencyKey: string;
  }): Promise<ProviderResult<{ messageId: string }>>;
  status(messageId: string): Promise<ProviderResult<{ status: "sent" | "delivered" | "failed" }>>;
}
