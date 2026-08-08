import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useRegionFilter } from "@/lib/data/useRegionFilter";

const mockUpdateDoc = jest.fn<(...args: any[]) => Promise<void>>();
const mockUseAuth = jest.fn<() => any>();

jest.mock("firebase/firestore", () => ({
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));
jest.mock("@/lib/firestore/collections", () => ({
  userDoc: (uid: string) => ({ path: `users/${uid}` }),
}));
jest.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

const session = (over: Record<string, unknown> = {}) => ({
  id: "bo_1",
  role: "backoffice",
  notificationRegion: null,
  ...over,
});

beforeEach(() => {
  mockUpdateDoc.mockReset();
  mockUpdateDoc.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ session: session(), loading: false });
});

test("defaults to null (Toute la France) once the session has loaded", async () => {
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});

test("reads a persisted 'SOUTH' off the session", async () => {
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("is not ready while the session is still loading", async () => {
  mockUseAuth.mockReturnValue({ session: null, loading: true });
  const { result } = await renderHook(() => useRegionFilter());
  expect(result.current.ready).toBe(false);
});

test("setRegion writes notificationRegion to the user doc", async () => {
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("NORTH"));
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    { path: "users/bo_1" },
    { notificationRegion: "NORTH" },
  );
});

test("setRegion(null) persists null rather than omitting the field", async () => {
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "NORTH" }),
    loading: false,
  });
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion(null));
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    { path: "users/bo_1" },
    { notificationRegion: null },
  );
});

test("the pick shows immediately and survives a failed write", async () => {
  // Optimistic: the dropdown must not sit on the old value waiting for the
  // network, and a rejected write must not throw out of the handler.
  mockUpdateDoc.mockRejectedValue(new Error("offline"));
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("SOUTH"));
  expect(result.current.region).toBe("SOUTH");
});

test("a session value arriving later wins over the stale default", async () => {
  const { result, rerender } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  await rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("a pick is dropped once the session reports the same value", async () => {
  // Otherwise the local override would mask a later change made on another
  // device — the session would say SOUTH and the dropdown would still show it
  // as a "pending" pick forever.
  const { result, rerender } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("SOUTH"));
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  await rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});
