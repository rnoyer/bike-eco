import { expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { frenchMessage, useAsyncAction } from "@/lib/ui/useAsyncAction";

/** A promise whose settlement this test controls, so `pending` can be observed
 *  while the action is genuinely in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test("pending is true while the action is in flight and false after", async () => {
  const d = deferred<string>();
  const { result } = await renderHook(() => useAsyncAction(() => d.promise));

  expect(result.current.pending).toBe(false);

  let ran!: Promise<string | undefined>;
  await act(async () => {
    ran = result.current.run();
  });
  expect(result.current.pending).toBe(true);

  await act(async () => {
    d.resolve("ok");
    await ran;
  });
  expect(result.current.pending).toBe(false);
  await expect(ran).resolves.toBe("ok");
});

test("a second run while one is in flight is skipped, not queued", async () => {
  const d = deferred<string>();
  const action = jest.fn(() => d.promise);
  const { result } = await renderHook(() => useAsyncAction(action));

  let first!: Promise<string | undefined>;
  let second!: Promise<string | undefined>;
  // Both taps land in the same tick — the case a `pending`-only guard misses,
  // because the state update has not re-rendered yet.
  await act(async () => {
    first = result.current.run();
    second = result.current.run();
  });

  expect(action).toHaveBeenCalledTimes(1);
  await expect(second).resolves.toBeUndefined();

  await act(async () => {
    d.resolve("ok");
    await first;
  });
  expect(action).toHaveBeenCalledTimes(1);
});

test("the guard releases, so a later run goes through", async () => {
  const action = jest.fn(async () => "ok");
  const { result } = await renderHook(() => useAsyncAction(action));

  await act(async () => void (await result.current.run()));
  await act(async () => void (await result.current.run()));

  expect(action).toHaveBeenCalledTimes(2);
});

test("a thrown French Error becomes `error`, and run resolves to undefined", async () => {
  const { result } = await renderHook(() =>
    useAsyncAction(async () => {
      throw new Error("Connexion impossible. Vérifiez votre réseau.");
    }),
  );

  let returned: unknown = "untouched";
  await act(async () => {
    returned = await result.current.run();
  });

  expect(returned).toBeUndefined();
  expect(result.current.error).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
  expect(result.current.pending).toBe(false);
});

test("mapError and onError are both applied", async () => {
  const onError = jest.fn();
  const { result } = await renderHook(() =>
    useAsyncAction(
      async () => {
        throw Object.assign(new Error("English"), {
          code: "auth/user-disabled",
        });
      },
      { mapError: () => "Ce compte a été désactivé.", onError },
    ),
  );

  await act(async () => void (await result.current.run()));

  expect(result.current.error).toBe("Ce compte a été désactivé.");
  expect(onError).toHaveBeenCalledWith("Ce compte a été désactivé.");
});

test("a new run clears the previous error, and reset clears it on demand", async () => {
  let fail = true;
  const { result } = await renderHook(() =>
    useAsyncAction(async () => {
      if (fail) throw new Error("Échec.");
      return "ok";
    }),
  );

  await act(async () => void (await result.current.run()));
  expect(result.current.error).toBe("Échec.");

  fail = false;
  await act(async () => void (await result.current.run()));
  expect(result.current.error).toBeNull();

  fail = true;
  await act(async () => void (await result.current.run()));
  expect(result.current.error).toBe("Échec.");

  await act(async () => result.current.reset());
  expect(result.current.error).toBeNull();
});

test("run keeps a stable identity across the hook's own re-renders", async () => {
  // Call sites pass a fresh arrow every render; `run` must not change with it,
  // or an effect depending on it would re-fire on every render.
  const { result } = await renderHook(() => useAsyncAction(async () => "ok"));

  const first = result.current.run;
  await act(async () => void (await result.current.run()));

  expect(result.current.run).toBe(first);
});

test("frenchMessage falls back for anything without a message", () => {
  expect(frenchMessage(new Error("Déjà en français."))).toBe(
    "Déjà en français.",
  );
  expect(frenchMessage(new Error(""))).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
  expect(frenchMessage("nope")).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
});
