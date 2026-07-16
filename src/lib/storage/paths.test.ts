import { expect, test } from "@jest/globals";
import {
  dossierPhotoPath,
  dossierThumbnailPath,
  extensionForUri,
  messageAttachmentPath,
  mimeForExtension,
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
