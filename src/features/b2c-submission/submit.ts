import { File as DeviceFile } from "expo-file-system";
import { Platform } from "react-native";

import { emulatorHost, USE_EMULATORS } from "../../../firebase.core";
import type { B2cSubmissionForm } from "./schema";

const PROJECT_ID = "bike-eco-43a84";
// Must match the functions' deploy region (`setGlobalOptions` in
// `functions/src/index.ts`); mirrors `getFunctions(app, ...)` in firebase.core.ts.
const REGION = "europe-west9";
const FUNCTION = "sendB2cSubmission";

/**
 * Resolve the function endpoint. Points at the local emulator only when the
 * rest of the app does, and at the deployed URL otherwise. Override with
 * EXPO_PUBLIC_FUNCTIONS_URL (the base up to, but excluding, the function name)
 * — e.g. to reach the emulator from a physical device over the LAN:
 * `http://192.168.1.x:5001/<project>/<region>`.
 *
 * Gated on `USE_EMULATORS`, not on `__DEV__`: this is an HTTP function called
 * with a bare `fetch`, so it is the one endpoint that does not go through the
 * SDK's `connectFunctionsEmulator` wiring and has to reproduce the decision
 * itself. Keying it off `__DEV__` alone made it the only part of the app that
 * ignored the `EXPO_PUBLIC_USE_EMULATORS` opt-in, so a dev build pointed at
 * production — the normal way this app is tested on a device — sent every B2C
 * submission to `10.0.2.2:5001` and failed with "Connexion impossible" while
 * Firestore, Auth and Storage all worked.
 */
function functionUrl(): string {
  const base = process.env.EXPO_PUBLIC_FUNCTIONS_URL;
  if (base) return `${base.replace(/\/$/, "")}/${FUNCTION}`;
  if (USE_EMULATORS) {
    return `http://${emulatorHost()}:5001/${PROJECT_ID}/${REGION}/${FUNCTION}`;
  }
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION}`;
}

/**
 * Append one photo to the form as a real Blob. The SDK 56 global `fetch` is
 * `expo/fetch` (WinterCG-compliant) on native, which only accepts spec Blob/File
 * parts — the legacy React Native `{ uri, name, type }` object throws
 * "Unsupported FormDataPart implementation". On native we wrap the local file in
 * `expo-file-system`'s `File` (which implements Blob); on web (no
 * expo-file-system) we fetch the picker's blob:/data: URI into a Blob.
 */
async function appendPhoto(
  form: FormData,
  uri: string,
  index: number
): Promise<void> {
  if (Platform.OS === "web") {
    // blob:/data: URIs carry no usable filename, so name from the Blob's MIME.
    const blob = await fetch(uri).then((r) => r.blob());
    const ext = blob.type.split("/")[1] || "jpg";
    form.append("photos", blob, `photo-${index + 1}.${ext}`);
    return;
  }
  const name = uri.split("/").pop() || `photo-${index + 1}.jpg`;
  form.append("photos", new DeviceFile(uri) as unknown as Blob, name);
}

/**
 * Submit the public B2C funnel: posts the form (minus photos) as JSON plus the
 * photos as multipart files. The Cloud Function sends the customer recap and the
 * NORTH/SOUTH team notification; nothing is persisted. Throws on failure with a
 * user-facing French message.
 */
export async function submitB2cSubmission(
  values: B2cSubmissionForm
): Promise<void> {
  const { photos, ...payload } = values;

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  // Sequential to preserve photo order in the multipart body.
  for (let i = 0; i < photos.length; i++) {
    await appendPhoto(form, photos[i], i);
  }

  let res: Response;
  try {
    // Content-Type (with multipart boundary) is set automatically by fetch.
    res = await fetch(functionUrl(), { method: "POST", body: form });
  } catch (e) {
    if (__DEV__) console.warn("[submitB2cSubmission] fetch failed:", e);
    throw new Error("Connexion impossible. Vérifiez votre réseau et réessayez.");
  }

  if (!res.ok) {
    let message = "L'envoi a échoué. Veuillez réessayer.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
}
