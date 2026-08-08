import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

import { db } from "../callable";
import type { NotificationContent, NotificationTarget } from "./copy";
import type { Delivery } from "./core";

/** `sendEachForMulticast` accepts at most 500 tokens per call. */
export const FCM_BATCH_SIZE = 500;

/**
 * Per-token errors that mean the handle is dead and its row should go.
 *
 * Deliberately excludes `messaging/invalid-argument`: `sendEachForMulticast`
 * sends one message per token but validates the *shared* payload (title,
 * body, data) only once, so a payload-level problem — a `moto` label long
 * enough to push the body past FCM's 4KB limit, or an empty title from a
 * copy regression — comes back as `invalid-argument` on EVERY response in
 * the batch, not just a bad token's. Treating it as a dead-token signal would
 * prune every registered device in that batch in one shot, instead of the
 * one device that's actually broken (there usually isn't one). Log it like
 * any other non-fatal failure and leave the rows alone.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** FCM data values must be strings, so the target is flattened, never nested. */
export function targetData(target: NotificationTarget): Record<string, string> {
  return target.kind === "company"
    ? { kind: target.kind, companyId: target.companyId }
    : { kind: target.kind, dossierId: target.dossierId };
}

export interface TokenRow {
  uid: string;
  deviceId: string;
  token: string;
}

/** A `pushTokens` row exactly as Firestore hands it back — `token` unvalidated. */
interface RawTokenRow {
  uid: string;
  deviceId: string;
  token: unknown;
}

export interface MulticastResult {
  success: boolean;
  /** An FCM error code, e.g. `"messaging/invalid-argument"`. Only set when `!success`. */
  errorCode?: string;
}

/**
 * The Firestore reads/writes and the FCM send that `dispatch` needs, factored
 * out so its grouping/batching/pruning logic — the part with real behaviour to
 * get wrong — can be unit tested against a fake, the same pattern used by
 * `messages/core.ts` and `users/core.ts`.
 */
export interface DispatchDeps {
  /**
   * Every registered device for these uids, as Firestore actually returns
   * them — NOT pre-validated. `users/{uid}/pushTokens/{deviceId}` is
   * owner-writable with no schema validation (`allow read, write: if
   * request.auth.uid == uid`, nothing else) in `firestore.rules`, so a row's
   * `token` may be missing or any type. `dispatch` does the filtering itself
   * (see below) rather than trusting this to have done it.
   */
  tokensFor(uids: string[]): Promise<RawTokenRow[]>;
  /** Delete a token row whose FCM handle is confirmed dead. */
  deleteToken(row: TokenRow): Promise<void>;
  /** Send one multicast; resolves to one result per token, in the same order as `tokens`. */
  sendMulticast(input: {
    tokens: string[];
    content: NotificationContent;
    target: NotificationTarget;
  }): Promise<MulticastResult[]>;
}

const firestoreDeps: DispatchDeps = {
  tokensFor: async (uids) => {
    const rows = await Promise.all(
      uids.map(async (uid) => {
        const snap = await db().collection("users").doc(uid).collection("pushTokens").get();
        return snap.docs.map((d) => ({ uid, deviceId: d.id, token: d.data().token as unknown }));
      }),
    );
    return rows.flat();
  },
  deleteToken: async (row) => {
    await db()
      .collection("users").doc(row.uid)
      .collection("pushTokens").doc(row.deviceId)
      .delete()
      .catch((e) => logger.warn("Failed to prune push token", { uid: row.uid, error: String(e) }));
  },
  sendMulticast: async ({ tokens, content, target }) => {
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: content.title, body: content.body },
      data: targetData(target),
      android: {
        priority: "high",
        notification: { channelId: "default" },
      },
      apns: { payload: { aps: { sound: "default" } } },
    });
    return result.responses.map((r) =>
      r.success ? { success: true } : { success: false, errorCode: r.error?.code ?? "" },
    );
  },
};

/**
 * Fan a resolved delivery list out to every registered device.
 *
 * One `sendMulticast` call per distinct notification body, batched at the
 * 500-token cap. Tokens whose per-token response says the handle is dead are
 * deleted — Apple and Google both ask that you stop sending to them.
 *
 * `deps` defaults to the real Firestore/FCM implementation; tests inject a
 * fake to exercise the grouping, batching and prune-vs-log decisions without
 * touching either service.
 */
export async function dispatch(deliveries: Delivery[], deps: DispatchDeps = firestoreDeps): Promise<void> {
  if (deliveries.length === 0) return;

  const rawRows = await deps.tokensFor([...new Set(deliveries.map((d) => d.uid))]);
  // The defensive filter lives here, not inside `tokensFor`: passing
  // `undefined` into `sendMulticast`'s token list would reject the *whole*
  // batch, turning one malformed `pushTokens` row into zero notifications for
  // everyone else batched with it.
  const rows: TokenRow[] = rawRows.filter(
    (row): row is TokenRow => typeof row.token === "string" && row.token.length > 0,
  );
  if (rows.length === 0) return;

  const byUid = new Map<string, TokenRow[]>();
  for (const row of rows) {
    byUid.set(row.uid, [...(byUid.get(row.uid) ?? []), row]);
  }

  // Recipients of an identical notification share one multicast. The key is the
  // rendered copy plus the target, so the message-event's two role-dependent
  // variants stay separate.
  const groups = new Map<string, { delivery: Delivery; rows: TokenRow[] }>();
  for (const delivery of deliveries) {
    const key = JSON.stringify([delivery.content, delivery.target]);
    const existing = groups.get(key);
    const forUid = byUid.get(delivery.uid) ?? [];
    if (existing) existing.rows.push(...forUid);
    else groups.set(key, { delivery, rows: [...forUid] });
  }

  for (const { delivery, rows: groupRows } of groups.values()) {
    // The unit of delivery is the TOKEN, not the row: one token is one device,
    // and a device must never be handed the same notification twice. Several
    // rows can carry one token —
    //
    //  - a client that loses its stored `deviceId` (app data cleared, a
    //    reinstall, a restore) re-registers under a fresh id while FCM hands
    //    it back the same handle, leaving a stale row behind. Nothing ever
    //    prunes that row: its token is alive, so every send to it *succeeds*,
    //    and the device buzzes twice for every notification from then on;
    //  - two accounts signed in on one phone, if the first's sign-out delete
    //    never landed;
    //  - the same uid appearing twice in `deliveries`, since the audience is
    //    built by concatenating two queries and the merge above appends that
    //    uid's rows once per delivery.
    //
    // Grouped rather than deduped so a dead-token response can still prune
    // every row that carried the handle — the ones left out of the batch are
    // never sent to again, so this is their only chance to be collected.
    const byToken = new Map<string, TokenRow[]>();
    for (const row of groupRows) {
      byToken.set(row.token, [...(byToken.get(row.token) ?? []), row]);
    }

    for (const batch of chunk([...byToken.keys()], FCM_BATCH_SIZE)) {
      if (batch.length === 0) continue;
      try {
        const responses = await deps.sendMulticast({
          tokens: batch,
          content: delivery.content,
          target: delivery.target,
        });
        await Promise.all(
          responses.map(async (response, i) => {
            if (response.success) return;
            const code = response.errorCode ?? "";
            const rows = byToken.get(batch[i]) ?? [];
            if (DEAD_TOKEN_CODES.has(code)) {
              await Promise.all(rows.map((row) => deps.deleteToken(row)));
            } else {
              logger.warn("Push send failed", { code, uid: rows[0]?.uid });
            }
          }),
        );
      } catch (e) {
        // `retry: false` on every trigger, so this is where a send failure
        // stops. A missed notification is strictly better than a duplicate.
        logger.error("Multicast failed", { error: String(e) });
      }
    }
  }
}
