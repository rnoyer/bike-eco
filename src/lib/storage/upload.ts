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
 * Upload a local file URI and return its download URL.
 *
 * React Native has no `File`, so the URI is read through `fetch` into a Blob —
 * the standard path for the Firebase JS SDK on native.
 */
export async function uploadLocalFile(
  uri: string,
  path: string,
  contentType: string,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
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
 */
export async function makeThumbnail(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: THUMBNAIL_WIDTH, height: null });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
