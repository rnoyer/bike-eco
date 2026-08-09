import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useRegionFilter } from "@/lib/data/useRegionFilter";

const mockUpdateDoc = jest.fn<(...args: any[]) => Promise<void>>();
const mockUseAuth = jest.fn<() => any>();
const mockUseUser = jest.fn<() => any>();

jest.mock("firebase/firestore", () => ({
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));
jest.mock("@/lib/firestore/collections", () => ({
  userDoc: (uid: string) => ({ path: `users/${uid}` }),
}));
jest.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("@/lib/data/useUser", () => ({
  useUser: (..._args: any[]) => mockUseUser(),
}));

const session = (over: Record<string, unknown> = {}) => ({
  id: "bo_1",
  role: "backoffice",
  ...over,
});

const profile = (over: Record<string, unknown> = {}) => ({
  notificationRegion: null,
  ...over,
});

beforeEach(() => {
  mockUpdateDoc.mockReset();
  mockUpdateDoc.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ session: session(), loading: false });
  mockUseUser.mockReturnValue({ data: profile(), loading: false });
});

test("defaults to null (Toute la France) once the profile has loaded", async () => {
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});

test("reads a persisted 'SOUTH' off the live user document", async () => {
  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "SOUTH" }),
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

test("is not ready while a signed-in session's profile is still loading", async () => {
  mockUseUser.mockReturnValue({ data: null, loading: true });
  const { result } = await renderHook(() => useRegionFilter());
  expect(result.current.ready).toBe(false);
});

test("a signed-out session is ready immediately, since useUser never resolves for it", async () => {
  // useUser(uid) stays `loading: true` forever for an empty uid — a signed-out
  // visitor must not be stranded waiting on a profile listener that has
  // nothing to subscribe to.
  mockUseAuth.mockReturnValue({ session: null, loading: false });
  mockUseUser.mockReturnValue({ data: null, loading: true });
  const { result } = await renderHook(() => useRegionFilter());
  expect(result.current.ready).toBe(true);
  expect(result.current.region).toBeNull();
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
  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "NORTH" }),
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

test("a live snapshot value arriving later wins over the stale default", async () => {
  const { result, rerender } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  await rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("a pick is dropped once the snapshot reports the same value, so a later external change isn't masked", async () => {
  // If `pending` never cleared, this hook would keep showing the local pick
  // ("SOUTH") forever, even after a second device changes it to "NORTH" and
  // the snapshot reports that. The first assertion below is reachable either
  // way (pending and persisted agree); only the second one, after an
  // out-of-band change nobody called `setRegion` for, distinguishes an
  // override that actually cleared from one that silently stuck around.
  const { result, rerender } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("SOUTH"));

  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  await rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));

  // A second device changes it, with no `setRegion` call on this instance.
  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "NORTH" }),
    loading: false,
  });
  await rerender({});
  await waitFor(() => expect(result.current.region).toBe("NORTH"));
});

test("both sibling-tab consumers observe a live notificationRegion change (regression: shared source, not per-component state)", async () => {
  // Settings and Dashboard are sibling NativeTabs that stay mounted together.
  // Each mounts its own `useRegionFilter`/`useUser` instance; both must read
  // the same live document rather than one being stuck on a stale value.
  const a = await renderHook(() => useRegionFilter());
  const b = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(a.result.current.ready).toBe(true));
  await waitFor(() => expect(b.result.current.ready).toBe(true));

  mockUseUser.mockReturnValue({
    data: profile({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  await a.rerender({});
  await b.rerender({});

  expect(a.result.current.region).toBe("SOUTH");
  expect(b.result.current.region).toBe("SOUTH");
});
