import { expect, test } from "@jest/globals";
import type { NotificationContent, NotificationTarget } from "./copy";
import type { Delivery } from "./core";
import { FCM_BATCH_SIZE, chunk, dispatch, targetData, type DispatchDeps, type MulticastResult, type TokenRow } from "./send";

test("chunk splits into batches of at most `size`", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk of an empty list is an empty list of batches", () => {
  expect(chunk([], 10)).toEqual([]);
});

test("chunk leaves a list shorter than `size` in one batch", () => {
  expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
});

test("the FCM batch size respects sendEachForMulticast's 500-token cap", () => {
  expect(FCM_BATCH_SIZE).toBeLessThanOrEqual(500);
});

test("targetData serializes every target as flat strings", () => {
  // FCM data values must be strings — a number or a nested object is rejected
  // at send time, not at compile time.
  expect(targetData({ kind: "company", companyId: "comp_1" })).toEqual({
    kind: "company",
    companyId: "comp_1",
  });
  expect(targetData({ kind: "dossier", dossierId: "dos_1" })).toEqual({
    kind: "dossier",
    dossierId: "dos_1",
  });
  expect(targetData({ kind: "chat", dossierId: "dos_1" })).toEqual({
    kind: "chat",
    dossierId: "dos_1",
  });
});

test("every targetData value is a string", () => {
  const data = targetData({ kind: "dossier", dossierId: "dos_1" });
  for (const value of Object.values(data)) {
    expect(typeof value).toBe("string");
  }
});

// ─── dispatch ─────────────────────────────────────────────────────────────
//
// `dispatch` is exercised against a fake `DispatchDeps` rather than real
// Firestore/FCM: it owns the grouping key, the batching, the zero-device
// short-circuit, the defensive token filter, and the prune-vs-log decision —
// all places a regression is silent in production (see Fix 1 below).

const DOSSIER_TARGET: NotificationTarget = { kind: "dossier", dossierId: "dos_1" };
const CONTENT_A: NotificationContent = { title: "A", body: "body A" };
const CONTENT_B: NotificationContent = { title: "B", body: "body B" };

function delivery(uid: string, content = CONTENT_A, target = DOSSIER_TARGET): Delivery {
  return { uid, content, target };
}

interface FakeRow {
  deviceId: string;
  token: unknown;
}

interface SendCall {
  tokens: string[];
  content: NotificationContent;
  target: NotificationTarget;
}

/**
 * A fake `DispatchDeps`. `tokens` maps uid -> its raw (unvalidated)
 * `pushTokens` rows, mirroring what a real Firestore read hands back.
 * `responses` lets a test script the per-token FCM result; it defaults to
 * "every token succeeds".
 */
function fakeDeps(params: {
  tokens: Record<string, FakeRow[]>;
  responses?: (tokens: string[]) => MulticastResult[];
}): { deps: DispatchDeps; sendCalls: SendCall[]; deleteCalls: TokenRow[] } {
  const sendCalls: SendCall[] = [];
  const deleteCalls: TokenRow[] = [];
  const deps: DispatchDeps = {
    tokensFor: async (uids) =>
      uids.flatMap((uid) =>
        (params.tokens[uid] ?? []).map((r) => ({ uid, deviceId: r.deviceId, token: r.token })),
      ),
    deleteToken: async (row) => {
      deleteCalls.push(row);
    },
    sendMulticast: async (input) => {
      sendCalls.push(input);
      return params.responses
        ? params.responses(input.tokens)
        : input.tokens.map(() => ({ success: true }));
    },
  };
  return { deps, sendCalls, deleteCalls };
}

test("dispatch: recipients of identical content+target share one multicast", async () => {
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [{ deviceId: "d1", token: "t1" }],
      u2: [{ deviceId: "d2", token: "t2" }],
    },
  });
  await dispatch([delivery("u1", CONTENT_A), delivery("u2", CONTENT_A)], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens.sort()).toEqual(["t1", "t2"]);
});

test("dispatch: different content (the message event's two role-dependent variants) sends separate multicasts", async () => {
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [{ deviceId: "d1", token: "t1" }],
      u2: [{ deviceId: "d2", token: "t2" }],
    },
  });
  await dispatch([delivery("u1", CONTENT_A), delivery("u2", CONTENT_B)], deps);

  expect(sendCalls).toHaveLength(2);
  const byTitle = new Map(sendCalls.map((c) => [c.content.title, c.tokens]));
  expect(byTitle.get("A")).toEqual(["t1"]);
  expect(byTitle.get("B")).toEqual(["t2"]);
});

test("dispatch: a recipient with zero registered devices is skipped without an empty-token send", async () => {
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [{ deviceId: "d1", token: "t1" }],
      // u2 has no pushTokens rows at all.
    },
  });
  await dispatch([delivery("u1"), delivery("u2")], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens).toEqual(["t1"]);
});

test("dispatch: no send at all when every recipient has zero devices", async () => {
  const { deps, sendCalls } = fakeDeps({ tokens: {} });
  await dispatch([delivery("u1"), delivery("u2")], deps);

  expect(sendCalls).toHaveLength(0);
});

test("dispatch: a row whose token is missing or non-string is filtered out and never reaches the send", async () => {
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [
        { deviceId: "d1", token: "t1" },
        { deviceId: "d2", token: undefined },
        { deviceId: "d3", token: 42 },
        { deviceId: "d4", token: "" },
      ],
    },
  });
  await dispatch([delivery("u1")], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens).toEqual(["t1"]);
});

test("dispatch: a registration-token-not-registered response deletes exactly that row and no other", async () => {
  const { deps, deleteCalls } = fakeDeps({
    tokens: {
      u1: [
        { deviceId: "d1", token: "t1" },
        { deviceId: "d2", token: "t2" },
      ],
    },
    responses: (tokens) =>
      tokens.map((_, i) =>
        i === 0
          ? { success: false, errorCode: "messaging/registration-token-not-registered" }
          : { success: true },
      ),
  });
  await dispatch([delivery("u1")], deps);

  expect(deleteCalls).toHaveLength(1);
  expect(deleteCalls[0]).toEqual({ uid: "u1", deviceId: "d1", token: "t1" });
});

test("dispatch: an invalid-argument response deletes NOTHING (Fix 1 regression pin)", async () => {
  // A payload-level `invalid-argument` (oversized body, empty title) comes
  // back on every response in the batch — not just one bad token's — so it
  // must never be treated as a dead-token signal. If `messaging/invalid-argument`
  // is ever added back to `DEAD_TOKEN_CODES`, this test fails.
  const { deps, deleteCalls } = fakeDeps({
    tokens: {
      u1: [
        { deviceId: "d1", token: "t1" },
        { deviceId: "d2", token: "t2" },
      ],
    },
    responses: (tokens) =>
      tokens.map(() => ({ success: false, errorCode: "messaging/invalid-argument" })),
  });
  await dispatch([delivery("u1")], deps);

  expect(deleteCalls).toHaveLength(0);
});

test("dispatch: one device with two rows carrying the same token is sent to once", async () => {
  // A client whose stored `deviceId` is lost (app data cleared, reinstall)
  // re-registers under a fresh id while FCM hands it back the SAME token, so
  // the user ends up with two rows pointing at one device. The stale row is
  // un-prunable — its token is alive, so every send to it succeeds — and
  // without this dedup the device shows every notification twice, forever.
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [
        { deviceId: "old", token: "t1" },
        { deviceId: "new", token: "t1" },
      ],
    },
  });
  await dispatch([delivery("u1")], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens).toEqual(["t1"]);
});

test("dispatch: two recipients sharing a device (same token, same copy) get one send", async () => {
  // Two accounts signed in on the same phone, the second without the first's
  // sign-out having cleared its row.
  const { deps, sendCalls } = fakeDeps({
    tokens: {
      u1: [{ deviceId: "d1", token: "shared" }],
      u2: [{ deviceId: "d2", token: "shared" }],
    },
  });
  await dispatch([delivery("u1", CONTENT_A), delivery("u2", CONTENT_A)], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens).toEqual(["shared"]);
});

test("dispatch: a dead token prunes EVERY row carrying it, not just one", async () => {
  // The flip side of the dedup: only one of the duplicate rows is in the
  // batch, so pruning by batch position alone would leave the others behind
  // holding a handle FCM has already rejected — and they would never be sent
  // to again, so nothing would ever prune them.
  const { deps, deleteCalls } = fakeDeps({
    tokens: {
      u1: [
        { deviceId: "old", token: "t1" },
        { deviceId: "new", token: "t1" },
      ],
    },
    responses: (tokens) =>
      tokens.map(() => ({
        success: false,
        errorCode: "messaging/registration-token-not-registered",
      })),
  });
  await dispatch([delivery("u1")], deps);

  expect(deleteCalls.map((r) => r.deviceId).sort()).toEqual(["new", "old"]);
});

test("dispatch: the same uid delivered twice with identical copy sends once", async () => {
  // `resolveDeliveries` builds its audience by concatenating two queries
  // (back-office + company members), so a uid that ever satisfies both would
  // arrive twice — and the grouping merge would append its tokens twice.
  const { deps, sendCalls } = fakeDeps({
    tokens: { u1: [{ deviceId: "d1", token: "t1" }] },
  });
  await dispatch([delivery("u1", CONTENT_A), delivery("u1", CONTENT_A)], deps);

  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].tokens).toEqual(["t1"]);
});

test("dispatch: batching splits at the 500-token cap", async () => {
  const uids = Array.from({ length: 501 }, (_, i) => `u${i}`);
  const tokens = Object.fromEntries(
    uids.map((uid, i) => [uid, [{ deviceId: `d${i}`, token: `t${i}` }]]),
  );
  const { deps, sendCalls } = fakeDeps({ tokens });
  await dispatch(uids.map((uid) => delivery(uid)), deps);

  expect(sendCalls).toHaveLength(2);
  expect(sendCalls[0].tokens).toHaveLength(500);
  expect(sendCalls[1].tokens).toHaveLength(1);
});
