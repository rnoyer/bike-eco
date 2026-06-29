import { expect, test } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useDossiers } from "@/lib/data/useDossiers";

test("starts loading then returns a_traiter dossiers", async () => {
  const { result } = await renderHook(() => useDossiers(["a_traiter"]));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data.every((d) => d.status === "a_traiter")).toBe(true);
});

test("region filter narrows the list to NORTH", async () => {
  const { result } = await renderHook(() => useDossiers(["a_traiter"], "NORTH"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data.every((d) => d.region === "NORTH")).toBe(true);
});
