import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { useRegionFilter } from "@/lib/data/useRegionFilter";

beforeEach(() => {
  (Storage.getItem as jest.Mock<any>).mockResolvedValue(null);
  (Storage.setItem as jest.Mock<any>).mockClear();
});

test("defaults to null (Toute la France) and becomes ready", async () => {
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});

test("setRegion persists 'NORTH' to kv-store", async () => {
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("NORTH"));
  expect(result.current.region).toBe("NORTH");
  expect(Storage.setItem).toHaveBeenCalledWith("bo.regionFilter", "NORTH");
});

test("restores a persisted 'SOUTH' value on mount", async () => {
  (Storage.getItem as jest.Mock<any>).mockResolvedValue("SOUTH");
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("kv-store rejection still marks ready and region stays null", async () => {
  (Storage.getItem as jest.Mock<any>).mockRejectedValue(new Error("kv down"));
  const { result } = await renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});
