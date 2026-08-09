import { deleteDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { useAccount } from "@/lib/data/useAccount";
import { dossierMuteDoc } from "@/lib/firestore/collections";

/**
 * Whether this user has muted a dossier's notifications.
 *
 * Presence of `dossiers/{id}/mutes/{uid}` means muted; absence means
 * subscribed. Modelling it as an opt-out is what makes "subscribed by default"
 * need no backfill and no write at dossier creation.
 *
 * Optimistic on toggle: the bell has to flip under the finger, and a failed
 * write is a preference that did not stick — the live snapshot will correct it.
 */
export function useDossierMute(dossierId: string) {
  const { data: session } = useAccount();
  const uid = session?.id ?? null;
  // Keyed like `useDossier`'s `resolved`: deriving `ready` from a key match
  // (rather than a synchronous `setReady(false)` in the effect body) avoids
  // the cascading-render lint rule and, for free, resets readiness the moment
  // `dossierId` changes — before the new subscription's first snapshot lands.
  const key = uid && dossierId ? `${uid}:${dossierId}` : null;
  const [resolved, setResolved] = useState<{ key: string; muted: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!uid || !dossierId) return;
    const currentKey = `${uid}:${dossierId}`;
    return onSnapshot(
      dossierMuteDoc(dossierId, uid),
      (snap) => setResolved({ key: currentKey, muted: snap.exists() }),
      (error) => {
        console.error("Mute listener failed", error);
        setResolved({ key: currentKey, muted: false });
      },
    );
  }, [uid, dossierId]);

  const ready = resolved?.key === key;
  const muted = ready ? resolved!.muted : false;

  const toggle = useCallback(() => {
    if (!uid || !dossierId || !ready) return;
    const next = !muted;
    setResolved({ key: `${uid}:${dossierId}`, muted: next });
    const ref = dossierMuteDoc(dossierId, uid);
    const write = next
      ? setDoc(ref, { createdAt: serverTimestamp() })
      : deleteDoc(ref);
    void write.catch(console.error);
  }, [uid, dossierId, muted, ready]);

  return { muted, toggle, ready };
}
