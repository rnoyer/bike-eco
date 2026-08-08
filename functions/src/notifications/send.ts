import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

import { db } from "../callable";
import type { NotificationTarget } from "./copy";
import type { Delivery } from "./core";

/** `sendEachForMulticast` accepts at most 500 tokens per call. */
export const FCM_BATCH_SIZE = 500;

/** Per-token errors that mean the handle is dead and its row should go. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
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

interface TokenRow {
  uid: string;
  deviceId: string;
  token: string;
}

/**
 * Every registered device for these uids.
 *
 * `users/{uid}/pushTokens/{deviceId}` is owner-writable with no schema
 * validation in the security rules (`allow read, write: if request.auth.uid
 * == uid`, nothing else) — a client could write any shape at all. So `token`
 * is read as `unknown` and rows without a non-empty string `token` are
 * dropped here rather than trusted: passing `undefined` into
 * `sendEachForMulticast`'s token list rejects the *entire* batch, turning one
 * malformed row into zero notifications for everyone else in it.
 */
async function tokensFor(uids: string[]): Promise<TokenRow[]> {
  const rows = await Promise.all(
    uids.map(async (uid) => {
      const snap = await db().collection("users").doc(uid).collection("pushTokens").get();
      return snap.docs
        .map((d) => ({ uid, deviceId: d.id, token: d.data().token as unknown }))
        .filter((row): row is TokenRow => typeof row.token === "string" && row.token.length > 0);
    }),
  );
  return rows.flat();
}

async function deleteToken(row: TokenRow): Promise<void> {
  await db()
    .collection("users").doc(row.uid)
    .collection("pushTokens").doc(row.deviceId)
    .delete()
    .catch((e) => logger.warn("Failed to prune push token", { uid: row.uid, error: String(e) }));
}

/**
 * Fan a resolved delivery list out to every registered device.
 *
 * One `sendEachForMulticast` call per distinct notification body, batched at
 * the 500-token cap. Tokens whose per-token response says the handle is dead
 * are deleted — Apple and Google both ask that you stop sending to them.
 */
export async function dispatch(deliveries: Delivery[]): Promise<void> {
  if (deliveries.length === 0) return;

  const rows = await tokensFor([...new Set(deliveries.map((d) => d.uid))]);
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
    for (const batch of chunk(groupRows, FCM_BATCH_SIZE)) {
      if (batch.length === 0) continue;
      try {
        const result = await getMessaging().sendEachForMulticast({
          tokens: batch.map((r) => r.token),
          notification: {
            title: delivery.content.title,
            body: delivery.content.body,
          },
          data: targetData(delivery.target),
          android: {
            priority: "high",
            notification: { channelId: "default" },
          },
          apns: { payload: { aps: { sound: "default" } } },
        });
        await Promise.all(
          result.responses.map(async (response, i) => {
            if (response.success) return;
            const code = response.error?.code ?? "";
            if (DEAD_TOKEN_CODES.has(code)) await deleteToken(batch[i]);
            else logger.warn("Push send failed", { code, uid: batch[i].uid });
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
