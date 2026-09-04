import { describe, expect, test } from "@jest/globals";
import { isDossierPhotoUrl, parseStorageDownloadUrl } from "./storageUrl";

const BUCKET = "bike-eco-43a84.firebasestorage.app";
const url = (path: string, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media&token=abc`;
const photo = (index: number, bucket = BUCKET) =>
  url(`dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F${index}.jpg`, bucket);

describe("parseStorageDownloadUrl", () => {
  test("returns the bucket and the encoded path, without the query string", () => {
    expect(parseStorageDownloadUrl(photo(0))).toEqual({
      bucket: BUCKET,
      path: "dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F0.jpg",
    });
  });

  test("accepts the storage emulator's loopback hosts", () => {
    for (const host of ["localhost:9199", "127.0.0.1:9199", "10.0.2.2:9199"]) {
      expect(
        parseStorageDownloadUrl(`http://${host}/v0/b/bkt/o/a.jpg?alt=media`),
      ).toEqual({ bucket: "bkt", path: "a.jpg" });
    }
  });

  test("rejects an external host mimicking the storage path", () => {
    expect(parseStorageDownloadUrl("https://evil.com/v0/b/bkt/o/a.jpg")).toBeNull();
  });

  test("rejects a url on our host that is not a download url", () => {
    expect(parseStorageDownloadUrl("https://firebasestorage.googleapis.com/v0/b/bkt")).toBeNull();
    expect(parseStorageDownloadUrl("https://firebasestorage.googleapis.com/o/a.jpg")).toBeNull();
  });

  test("rejects a non-http scheme and an unparseable value", () => {
    expect(parseStorageDownloadUrl("javascript:alert(1)")).toBeNull();
    expect(parseStorageDownloadUrl("not a url")).toBeNull();
  });
});

describe("isDossierPhotoUrl", () => {
  const scope = { bucket: BUCKET, companyId: "comp_1", dossierId: "dos_1" };

  test("accepts a photo of this dossier in our bucket", () => {
    expect(isDossierPhotoUrl(photo(0), scope)).toBe(true);
  });

  // The whole point of checking the bucket: anyone can create a Firebase
  // project, so an attacker's own download URL is on our host too.
  test("rejects the same path in someone else's bucket", () => {
    expect(isDossierPhotoUrl(photo(0, "attacker-project.firebasestorage.app"), scope)).toBe(
      false,
    );
  });

  test("rejects another dossier's or another company's photo", () => {
    expect(
      isDossierPhotoUrl(url("dossiers%2Fcomp_1%2Fdos_2%2Fphotos%2F0.jpg"), scope),
    ).toBe(false);
    expect(
      isDossierPhotoUrl(url("dossiers%2Fcomp_2%2Fdos_1%2Fphotos%2F0.jpg"), scope),
    ).toBe(false);
  });

  test("rejects this dossier's message attachments (right dossier, wrong subtree)", () => {
    expect(
      isDossierPhotoUrl(url("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fm1%2Fx.jpg"), scope),
    ).toBe(false);
  });

  test("rejects an arbitrary external link", () => {
    expect(isDossierPhotoUrl("https://evil.example/phish.html", scope)).toBe(false);
  });

  test("falls back to host + path when the bucket is unknown", () => {
    const unknown = { ...scope, bucket: null };
    expect(isDossierPhotoUrl(photo(0, "any-bucket"), unknown)).toBe(true);
    expect(isDossierPhotoUrl("https://evil.example/phish.html", unknown)).toBe(false);
  });
});
