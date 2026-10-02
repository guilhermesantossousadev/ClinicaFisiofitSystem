import { describe, expect, it, vi } from "vitest";
import { createOccurrenceCancellation } from "./occurrenceCancellation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function handlers() {
  return {
    request: vi.fn(async (_id: string) => {}),
    onPending: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    refresh: vi.fn(async (_id: string) => {}),
    onRefreshError: vi.fn(),
  };
}

describe("occurrence cancellation", () => {
  it("does not request anything before the confirmation action runs", () => {
    const h = handlers();
    createOccurrenceCancellation(h);
    expect(h.request).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("calls the cancel endpoint for only the confirmed occurrence", async () => {
    const h = handlers();
    const execute = createOccurrenceCancellation(h);
    await execute("occurrence-a");
    expect(h.request).toHaveBeenCalledExactlyOnceWith("occurrence-a");
    expect(h.onSuccess).toHaveBeenCalledExactlyOnceWith("occurrence-a");
    expect(h.refresh).toHaveBeenCalledExactlyOnceWith("occurrence-a");
  });

  it("keeps loading active and ignores a second click while pending", async () => {
    const h = handlers();
    const response = deferred<void>();
    h.request.mockReturnValue(response.promise);
    const execute = createOccurrenceCancellation(h);
    const first = execute("occurrence-a");
    const second = await execute("occurrence-b");
    expect(second).toBe(false);
    expect(h.request).toHaveBeenCalledExactlyOnceWith("occurrence-a");
    expect(h.onPending).toHaveBeenNthCalledWith(1, true);
    response.resolve();
    expect(await first).toBe(true);
    expect(h.onPending).toHaveBeenLastCalledWith(false);
  });

  it("reports cancellation errors without reporting success or refreshing", async () => {
    const h = handlers();
    const error = new Error("request failed");
    h.request.mockRejectedValue(error);
    const execute = createOccurrenceCancellation(h);
    expect(await execute("occurrence-a")).toBe(false);
    expect(h.onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(h.onSuccess).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("keeps the successful cancel separate from refresh failures", async () => {
    const h = handlers();
    const error = new Error("refresh failed");
    h.refresh.mockRejectedValue(error);
    const execute = createOccurrenceCancellation(h);
    expect(await execute("occurrence-a")).toBe(true);
    expect(h.onSuccess).toHaveBeenCalledExactlyOnceWith("occurrence-a");
    expect(h.onRefreshError).toHaveBeenCalledExactlyOnceWith(error);
    expect(h.onError).not.toHaveBeenCalled();
  });
});
