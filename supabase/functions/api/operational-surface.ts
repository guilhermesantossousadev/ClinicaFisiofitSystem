// Temporary operational workspace. Authentication and clinic/unit checks still
// run; only these routes remain available while the other modules are paused.
export function isOperationalRoute(path: string, method: string): boolean {
  const route = path.replace(/^\/api\/v1(?=\/|$)/, "");
  if (method === "GET" && ["/units", "/rooms", "/professionals", "/services"].includes(route)) return true;
  if (method === "GET" && route === "/payments") return true;
  if (method === "POST" && route === "/payments") return true;
  if (route.startsWith("/payments/")) return false;
  if (/^\/enrollments\/[^/]+\/(rollback|cancel|lifecycle)$/.test(route)) return true;
  if (/^\/charges\/[^/]+\/status$/.test(route)) return false;
  if (method === "DELETE" && /^\/patients\/[^/]+$/.test(route)) return false;
  if (route.startsWith("/patients/") && route.endsWith("/timeline")) return false;
  if (/^\/(patients|plans|enrollments|enrollment-price-terms|charges|appointments|classes|class-memberships|class-occurrences|calendar-items|group-slots|group-slot-memberships|attendance|makeup-credits|agenda-exceptions)(\/|$)/.test(route)) return true;
  return false;
}
