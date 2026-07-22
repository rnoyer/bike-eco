import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import type { SessionUser } from "@/lib/auth/session";
import { mapDataError } from "@/lib/data/dataErrors";
import { companyDoc, dossiersRef } from "@/lib/firestore/collections";
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
    const companySnap = await getDoc(companyDoc(companyId));
    const companyName = companySnap.data()?.name ?? "";

    await cleanUpOnFailure(async (track) => {
      const thumbPath = dossierThumbnailPath(companyId, ref.id);
      const thumbnailUrl = await uploadLocalFile(
        await makeThumbnail(values.photos[0]),
        thumbPath,
        "image/jpeg",
      );
      track(thumbPath);

      const urls: string[] = [];
      for (const [index, uri] of values.photos.entries()) {
        const ext = extensionForUri(uri);
        const path = dossierPhotoPath(companyId, ref.id, index, ext);
        urls.push(await uploadLocalFile(uri, path, mimeForExtension(ext)));
        track(path);
      }

      await setDoc(ref, {
        ...toDossierPayload(
          values,
          session,
          { id: companyId, name: companyName },
          { urls, thumbnailUrl },
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, removeStorageObject);
  } catch (error) {
    throw new Error(mapDataError((error as { code?: string }).code ?? ""));
  }
}
