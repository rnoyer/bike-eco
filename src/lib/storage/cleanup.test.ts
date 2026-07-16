import { expect, jest, test } from "@jest/globals";
import { cleanUpOnFailure } from "./cleanup";

test("on success it returns the result and deletes nothing", async () => {
  const remove = jest.fn(async () => {});
  const result = await cleanUpOnFailure(async (track) => {
    track("dossiers/c/d/photos/0.jpg");
    return "dos_1";
  }, remove);

  expect(result).toBe("dos_1");
  expect(remove).not.toHaveBeenCalled();
});

test("a failure deletes everything already uploaded and rethrows", async () => {
  const removed: string[] = [];
  const remove = jest.fn(async (path: string) => void removed.push(path));
  const boom = new Error("upload failed");

  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/0.jpg");
      track("dossiers/c/d/photos/1.jpg");
      throw boom;
    }, remove),
  ).rejects.toBe(boom);

  expect(removed).toEqual([
    "dossiers/c/d/photos/0.jpg",
    "dossiers/c/d/photos/1.jpg",
  ]);
});

test("a failed commit still cleans up its uploads", async () => {
  const removed: string[] = [];
  const remove = jest.fn(async (path: string) => void removed.push(path));

  // The dossier document is written last; if that write fails, the photos it
  // would have referenced must not survive.
  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/thumb.jpg");
      throw Object.assign(new Error("denied"), { code: "permission-denied" });
    }, remove),
  ).rejects.toThrow("denied");

  expect(removed).toEqual(["dossiers/c/d/photos/thumb.jpg"]);
});

test("a cleanup that itself fails does not mask the original error", async () => {
  const original = new Error("original");
  const remove = jest.fn(async () => {
    throw new Error("delete failed");
  });

  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/0.jpg");
      throw original;
    }, remove),
  ).rejects.toBe(original);
});
