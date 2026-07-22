/** How long a Firestore write may take to be acknowledged before we fail fast. */
export const WRITE_TIMEOUT_MS = 15000;

/**
 * Race a Firestore write against a fail-fast timeout.
 *
 * Firestore buffers a write it can't reach the server with: `setDoc` neither
 * resolves nor rejects, so a submit would hang forever with no feedback and its
 * uploaded files would never be cleaned up. This gives the write `timeoutMs` to
 * be acknowledged; if it isn't, `compensate` runs (the caller queues a delete so
 * a write that commits later is immediately undone) and the call rejects with an
 * `unavailable` code — which `mapDataError` turns into a network error message.
 *
 * Pure on purpose: the Firestore calls stay in the caller so this stays testable.
 */
export async function writeWithTimeout<T>(
  write: () => Promise<T>,
  compensate: () => void,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      compensate();
      reject(
        Object.assign(new Error("La demande a expiré."), { code: "unavailable" }),
      );
    }, timeoutMs);
  });

  const writing = write();
  try {
    return await Promise.race([writing, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    // If the timeout won the race, the buffered write is still pending; swallow a
    // late rejection so it can't surface as an unhandled promise rejection.
    writing.catch(() => {});
  }
}
