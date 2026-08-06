import { expect, test } from "@jest/globals";
import {
  dossierPhotoPath,
  dossierThumbnailPath,
  extensionForUri,
  messageAttachmentPath,
  mimeForExtension,
  rewriteEmulatorHost,
  sanitizeFileName,
} from "./paths";

test("photo and thumbnail paths are keyed by company then dossier", () => {
  expect(dossierPhotoPath("comp_1", "dos_1", 2, "jpg")).toBe(
    "dossiers/comp_1/dos_1/photos/2.jpg",
  );
  expect(dossierThumbnailPath("comp_1", "dos_1")).toBe(
    "dossiers/comp_1/dos_1/photos/thumb.jpg",
  );
});

test("attachment paths nest under their message", () => {
  expect(messageAttachmentPath("comp_1", "dos_1", "msg_1", "offre.pdf")).toBe(
    "dossiers/comp_1/dos_1/messages/msg_1/offre.pdf",
  );
});

test("a file name cannot break out of its path segment", () => {
  expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
  expect(sanitizeFileName("mon rapport (1).pdf")).toBe("mon_rapport__1_.pdf");
  expect(sanitizeFileName("")).toBe("fichier");
  expect(messageAttachmentPath("comp_1", "dos_1", "msg_1", "a/b.pdf")).toBe(
    "dossiers/comp_1/dos_1/messages/msg_1/a_b.pdf",
  );
});

test("extensions come from the uri, defaulting to jpg", () => {
  expect(extensionForUri("file:///tmp/IMG_0001.HEIC")).toBe("heic");
  expect(extensionForUri("file:///tmp/photo.png")).toBe("png");
  expect(extensionForUri("file:///tmp/photo.jpg?width=10")).toBe("jpg");
  expect(extensionForUri("file:///tmp/no-extension")).toBe("jpg");
  expect(extensionForUri("file:///tmp/weird.tiff")).toBe("jpg");
});

test("extensions map back to the content type Storage rules match on", () => {
  expect(mimeForExtension("jpg")).toBe("image/jpeg");
  expect(mimeForExtension("png")).toBe("image/png");
  expect(mimeForExtension("nope")).toBe("image/jpeg");
});

// The bug this guards: a download URL minted against the Storage emulator on one
// platform is persisted verbatim and then unreachable from the other.
test("emulator download URLs are re-pointed at the local host", () => {
  const web =
    "http://localhost:9199/v0/b/bike-eco-43a84.firebasestorage.app/o/dossiers%2Fc%2Fd%2Fphotos%2F0.jpg?alt=media&token=abc";

  expect(rewriteEmulatorHost(web, "10.0.2.2")).toBe(
    "http://10.0.2.2:9199/v0/b/bike-eco-43a84.firebasestorage.app/o/dossiers%2Fc%2Fd%2Fphotos%2F0.jpg?alt=media&token=abc",
  );
  // …and the other direction, for a dossier filed from Android.
  expect(
    rewriteEmulatorHost("http://10.0.2.2:9199/v0/b/x/o/y?alt=media", "localhost"),
  ).toBe("http://localhost:9199/v0/b/x/o/y?alt=media");
  expect(rewriteEmulatorHost("http://127.0.0.1:9199/a", "10.0.2.2")).toBe(
    "http://10.0.2.2:9199/a",
  );
});

test("production and local uris are left alone", () => {
  const prod =
    "https://firebasestorage.googleapis.com/v0/b/bike-eco-43a84.firebasestorage.app/o/dossiers%2Fc%2Fd%2Fphotos%2F0.jpg?alt=media&token=abc";
  expect(rewriteEmulatorHost(prod, "10.0.2.2")).toBe(prod);
  // A staged, not-yet-sent attachment.
  expect(rewriteEmulatorHost("file:///tmp/photo.jpg", "10.0.2.2")).toBe(
    "file:///tmp/photo.jpg",
  );
  // Only the origin is rewritten — a matching host later in the URL is not.
  expect(
    rewriteEmulatorHost("https://example.com/r?to=http://localhost:9199/a", "10.0.2.2"),
  ).toBe("https://example.com/r?to=http://localhost:9199/a");
});
