import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalRoute } from "../supabase/functions/api/operational-surface.ts";

test("mantém abertos os passos necessários do cadastro até a chamada", () => {
  for (const [method, path] of [
    ["GET", "/api/v1/patients"], ["POST", "/api/v1/patients"],
    ["POST", "/api/v1/plans"], ["POST", "/api/v1/enrollments"],
    ["GET", "/api/v1/charges"], ["POST", "/api/v1/charges"],
    ["GET", "/api/v1/payments"], ["POST", "/api/v1/payments"],
    ["POST", "/api/v1/group-slots"], ["POST", "/api/v1/classes/00000000-0000-4000-8000-000000000001/memberships"],
    ["GET", "/api/v1/calendar-items"], ["GET", "/api/v1/attendance/daily"],
    ["PUT", "/api/v1/class-occurrences/00000000-0000-4000-8000-000000000001/attendance/00000000-0000-4000-8000-000000000002"],
  ]) assert.equal(isOperationalRoute(path, method), true, `${method} ${path}`);
});

test("pausa módulos alheios e operações financeiras sem matrícula", () => {
  for (const [method, path] of [
    ["GET", "/api/v1/dashboard"], ["GET", "/api/v1/clinical-records"],
    ["GET", "/api/v1/financial-entries"], ["POST", "/api/v1/financial-entries"],
    ["GET", "/api/v1/users"], ["POST", "/api/v1/users/invite"],
    ["GET", "/api/v1/privacy/requests"], ["GET", "/api/v1/reports/monthly"],
    ["POST", "/api/v1/imports"], ["POST", "/api/v1/payments/00000000-0000-4000-8000-000000000001/reverse"],
  ]) assert.equal(isOperationalRoute(path, method), false, `${method} ${path}`);
});
