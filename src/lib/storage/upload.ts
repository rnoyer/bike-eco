import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../../firebaseConfig";

/** Card thumbnails render small; a camera photo is megabytes of wasted list. */
const THUMBNAIL_WIDTH = 400;

/**
 * Read a local file URI into a Blob.
 *
 * On React Native `fetch(uri).blob()` throws "Creating blobs from 'ArrayBuffer'
 * … are not supported": RN reads the file body into an ArrayBuffer that its Blob
 * polyfill cannot wrap. XMLHttpRequest with `responseType: "blob"` yields a real
 * native Blob directly — the approach in Expo's Firebase Storage example — which
 * the Firebase SDK can then upload without reconstructing it from bytes.
 */
function blobFromUri(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError("Lecture du fichier impossible."));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

/** Upload a local file URI and return its download URL. */
export async function uploadLocalFile(
  uri: string,
  path: string,
  contentType: string,
): Promise<string> {
  const blob = await blobFromUri(uri);
  const target = storageRef(storage, path);
  await uploadBytes(target, blob, { contentType });
  return getDownloadURL(target);
}

export async function removeStorageObject(path: string): Promise<void> {
  await deleteObject(storageRef(storage, path));
}

/**
 * Downscale a photo for `Dossier.thumbnailUrl` ("low-res first photo").
 * SDK 56 API: `manipulateAsync` is deprecated in favour of this context form.
 *
 * `height` is *omitted*, not `null`. Both typecheck (`resize` takes
 * `number | null`) and both mean "derive it from the ratio" on native, but the
 * web implementation branches on `height !== undefined`: an explicit `null`
 * passes that check and becomes the height, so the resample asks for a
 * zero-height ImageData and the browser throws before any upload starts.
 */
export async function makeThumbnail(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: THUMBNAIL_WIDTH });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
