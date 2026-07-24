import { expect, test } from "@jest/globals";
import { filterCompaniesByRegion } from "./selectCompanies";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

const make = (id: string, region: "NORTH" | "SOUTH"): WithId<Company> =>
  ({ id, region } as WithId<Company>);

test("null region keeps every company", () => {
  const list = [make("a", "NORTH"), make("b", "SOUTH")];
  expect(filterCompaniesByRegion(list, null).map((c) => c.id)).toEqual(["a", "b"]);
});

test("a region keeps only matching companies", () => {
  const list = [make("a", "NORTH"), make("b", "SOUTH")];
  expect(filterCompaniesByRegion(list, "SOUTH").map((c) => c.id)).toEqual(["b"]);
});
