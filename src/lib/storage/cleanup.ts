/**
 * Run `work`, deleting every path it reported to `track` if it throws.
 *
 * The dossier document is written last and inside `work`, so anything uploaded
 * before a failure — whether an upload or the final write — would be referenced
 * by nothing. Orphaned objects have no use-case and are not kept.
 *
 * Best-effort by nature: it cannot cover the app being killed mid-upload, where
 * this `catch` never runs.
 *
 * Cleanup failures are swallowed (`allSettled`) so the original error, which is
 * what the user needs to see, still surfaces.
 */
export async function cleanUpOnFailure<R>(
  work: (track: (path: string) => void) => Promise<R>,
  remove: (path: string) => Promise<void>,
): Promise<R> {
  const uploaded: string[] = [];
  try {
    return await work((path) => {
      uploaded.push(path);
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((path) => remove(path)));
    throw error;
  }
}
