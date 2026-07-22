import { expect, test } from "@jest/globals";
import { redirectFor, resolveAuthRoute } from "./routeGuard";

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

// redirectFor: given the resolved route + the current segments, where to send
// the user (or null to stay). This is the regression net for "signed-in but
// stranded on index": a remount can drop the user on `index`, and the guard
// must still push them to their dashboard from there.
test("b2b user stranded on index is redirected to the b2b dashboard", () => {
  expect(redirectFor("b2b", ["index"])).toBe("/(b2b)/(tabs)/dashboard");
  expect(redirectFor("backoffice", ["index"])).toBe("/(backoffice)/(tabs)/dashboard");
});

test("b2b user redirected to dashboard from the auth group after sign-in", () => {
  expect(redirectFor("b2b", ["(auth)", "signin"])).toBe("/(b2b)/(tabs)/dashboard");
  expect(redirectFor("backoffice", ["(auth)", "signin"])).toBe("/(backoffice)/(tabs)/dashboard");
});

test("no redirect once already in the correct group", () => {
  expect(redirectFor("b2b", ["(b2b)", "(tabs)", "dashboard"])).toBeNull();
  expect(redirectFor("backoffice", ["(backoffice)", "(tabs)", "dashboard"])).toBeNull();
});

test("unauthenticated stays on public routes, bounced from protected ones", () => {
  expect(redirectFor("signin", ["index"])).toBeNull();
  expect(redirectFor("signin", ["b2cSubmissionForm"])).toBeNull();
  expect(redirectFor("signin", ["(auth)", "signin"])).toBeNull();
  expect(redirectFor("signin", ["(b2b)", "(tabs)", "dashboard"])).toBe("/(auth)/signin");
});

test("pending redirect fires unless already on the pending screen", () => {
  expect(redirectFor("pending", ["index"])).toBe("/(auth)/pending");
  expect(redirectFor("pending", ["(auth)", "pending"])).toBeNull();
});

test("loading never redirects", () => {
  expect(redirectFor("loading", ["index"])).toBeNull();
});
