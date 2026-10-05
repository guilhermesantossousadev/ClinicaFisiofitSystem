export type OccurrenceCancellationHandlers = {
  request: (occurrenceId: string) => Promise<void>;
  onPending: (pending: boolean) => void;
  onSuccess: (occurrenceId: string) => void;
  onError: (error: unknown) => void;
  refresh: (occurrenceId: string) => Promise<void>;
  onRefreshError: (error: unknown) => void;
};

export function createOccurrenceCancellation(handlers: OccurrenceCancellationHandlers) {
  let pending = false;
  return async (occurrenceId: string) => {
    if (pending) return false;
    pending = true;
    handlers.onPending(true);
    try {
      await handlers.request(occurrenceId);
      handlers.onSuccess(occurrenceId);
      try { await handlers.refresh(occurrenceId); }
      catch (error) { handlers.onRefreshError(error); }
      return true;
    } catch (error) {
      handlers.onError(error);
      return false;
    } finally {
      pending = false;
      handlers.onPending(false);
    }
  };
}
