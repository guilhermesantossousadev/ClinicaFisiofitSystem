const portalStoragePrefix = "fisiofit:";
const sessionOwnerKey = "fisiofit:session-user";

export const operationalResourceCache = new Map<string, Record<string, unknown>>();
let portalSessionGeneration = 0;

export function getPortalSessionGeneration() {
  return portalSessionGeneration;
}

function clearPortalStorage(storage: Storage, retainedKeys = new Set<string>()) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(portalStoragePrefix) && !retainedKeys.has(key)) storage.removeItem(key);
  }
}

export function clearPortalSessionState() {
  portalSessionGeneration += 1;
  operationalResourceCache.clear();
  if (typeof window === "undefined") return;

  try { clearPortalStorage(window.localStorage); } catch { /* armazenamento indisponível */ }
  try {
    clearPortalStorage(window.sessionStorage, new Set(["fisiofit:session-expired-notice"]));
  } catch { /* armazenamento indisponível */ }
}

export function bindPortalSessionToUser(userId: string) {
  if (typeof window === "undefined") return;

  let previousUserId: string | null = null;
  try { previousUserId = window.localStorage.getItem(sessionOwnerKey); } catch { /* armazenamento indisponível */ }

  if (previousUserId !== userId) clearPortalSessionState();
  try { window.localStorage.setItem(sessionOwnerKey, userId); } catch { /* armazenamento indisponível */ }
}
