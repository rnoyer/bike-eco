import {
  deleteDoc,
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import type { SessionUser } from "@/lib/auth/session";
import { mapDataError } from "@/lib/data/dataErrors";
import { companyDoc, dossiersRef } from "@/lib/firestore/collections";
import {
  WRITE_TIMEOUT_MS,
  writeWithTimeout,
} from "@/lib/firestore/writeWithTimeout";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import {
  dossierPhotoPath,
  dossierThumbnailPath,
  extensionForUri,
  mimeForExtension,
} from "@/lib/storage/paths";
import {
  makeThumbnail,
  removeStorageObject,
  uploadLocalFile,
} from "@/lib/storage/upload";
import type { B2bSubmissionForm } from "./schema";
import { toDossierPayload } from "./toDossier";

/**
 * File a dossier for the signed-in dealer: mint an id, upload the photos under
 * it, then write the document last.
 *
 * Ordering matters. The id comes from `doc()` without a write, so photos can be
 * stored under their final path before anything references them; the document is
 * written last so a failed upload can never leave a dossier pointing at photos
 * that do not exist. `cleanUpOnFailure` deletes whatever landed if any step —
 * including that final write — throws.
 *
 * A `getDocFromServer` probe gates the whole thing: an offline write would be
 * *buffered* by Firestore (not rejected) and commit later — stranding a dossier
 * whose photos we already cleaned up. Reads don't buffer, and forcing the server
 * (not the cache) makes this reject fast when the backend is unreachable, so we
 * fail before uploading anything or queuing a write.
 */
export async function submitB2bSubmission(
  values: B2bSubmissionForm,
  session: SessionUser,
): Promise<void> {
  const companyId = session.companyId;
  if (!companyId) {
    throw new Error("Aucune société n'est associée à votre compte.");
  }

  const ref = doc(dossiersRef);

  try {
    // Reachability gate — also the source of the company name (see the note above).
    const companySnap = await getDocFromServer(companyDoc(companyId));
    const companyName = companySnap.data()?.name ?? "";

    await cleanUpOnFailure(async (track) => {
      const thumbPath = dossierThumbnailPath(companyId, ref.id);
      track(thumbPath);
      const thumbnailUrl = await uploadLocalFile(
        await makeThumbnail(values.photos[0]),
        thumbPath,
        "image/jpeg",
      );

      const urls: string[] = [];
      for (const [index, uri] of values.photos.entries()) {
        const ext = extensionForUri(uri);
        const path = dossierPhotoPath(companyId, ref.id, index, ext);
        track(path);
        urls.push(await uploadLocalFile(uri, path, mimeForExtension(ext)));
      }

      // Firestore buffers a write it can't reach the server with, so a plain
      // `setDoc` would hang here forever (no throw → no cleanup, no alert).
      // Fail fast; the compensating delete undoes the write if it commits later.
      await writeWithTimeout(
        () =>
          setDoc(ref, {
            ...toDossierPayload(
              values,
              session,
              { id: companyId, name: companyName },
              { urls, thumbnailUrl },
            ),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        () => void deleteDoc(ref).catch(() => {}),
        WRITE_TIMEOUT_MS,
      );
    }, removeStorageObject);
  } catch (error) {
    throw new Error(mapDataError((error as { code?: string }).code ?? ""));
  }
}
