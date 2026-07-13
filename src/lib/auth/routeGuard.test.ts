import { expect, test } from "@jest/globals";
import { resolveAuthRoute } from "./routeGuard";

test("loading wins over everything", () => {
  expect(resolveAuthRoute({ loading: true, role: null, status: null })).toBe("loading");
});

test("no session routes to signin", () => {
  expect(resolveAuthRoute({ loading: false, role: null, status: null })).toBe("signin");
});

test("non-active status is blocked at the pending screen", () => {
  expect(resolveAuthRoute({ loading: false, role: "b2b", status: "pending" })).toBe("pending");
});

test("active users route by role", () => {
  expect(resolveAuthRoute({ loading: false, role: "b2b", status: "active" })).toBe("b2b");
  expect(resolveAuthRoute({ loading: false, role: "backoffice", status: "active" })).toBe("backoffice");
});
