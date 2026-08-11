import { describe, expect, test } from "@jest/globals";
import {
  hasMateriel,
  kilometres,
  ouiNon,
  REGION_LABELS,
  submittedAt,
} from "./labels";

describe("kilometres", () => {
  test("puts the unit in the value", () => {
    expect(kilometres(48000)).toBe("48000 km");
  });

  test("dashes an absent distance rather than printing a bare unit", () => {
    expect(kilometres(null)).toBe("—");
    expect(kilometres(undefined)).toBe("—");
  });
});

describe("ouiNon", () => {
  test("capitalises the stored answer, as the B2C emails do", () => {
    expect(ouiNon("oui")).toBe("Oui");
    expect(ouiNon("non")).toBe("Non");
  });

  test("returns the empty string for an unanswered field, so the row drops", () => {
    expect(ouiNon(null)).toBe("");
    expect(ouiNon(undefined)).toBe("");
  });
});

describe("hasMateriel", () => {
  test("reads the funnel's checkbox labels", () => {
    const materiel = ["J'ai la batterie"];
    expect(hasMateriel(materiel, "batterie")).toBe(true);
    expect(hasMateriel(materiel, "chargeur")).toBe(false);
  });

  test("tolerates a missing list", () => {
    expect(hasMateriel(null, "batterie")).toBe(false);
    expect(hasMateriel(undefined, "chargeur")).toBe(false);
  });
});

describe("REGION_LABELS", () => {
  test("names both régions in French", () => {
    expect(REGION_LABELS.NORTH).toBe("Nord");
    expect(REGION_LABELS.SOUTH).toBe("Sud");
  });
});

describe("submittedAt", () => {
  // 2026-07-26T12:30:00Z is 14:30 in Paris (CEST, UTC+2). Functions run in
  // UTC, so a formatter without an explicit zone would print 12:30 here.
  test("formats in Europe/Paris as JJ MMM AAAA hh:mm", () => {
    const ts = { toDate: () => new Date("2026-07-26T12:30:00Z") };
    expect(submittedAt(ts)).toBe("26 juil. 2026 14:30");
  });

  // 00:30 Paris on the 1st is 22:30 UTC on the previous day — the case that
  // would silently date a dossier a day early.
  test("keeps a just-after-midnight submission on the Paris day", () => {
    const ts = { toDate: () => new Date("2026-06-30T22:30:00Z") };
    expect(submittedAt(ts)).toBe("01 juil. 2026 00:30");
  });

  test("dashes an absent timestamp", () => {
    expect(submittedAt(null)).toBe("—");
    expect(submittedAt(undefined)).toBe("—");
  });
});
