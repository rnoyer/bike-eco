import { describe, expect, test } from "@jest/globals";
import type { Timestamp } from "firebase/firestore";

import { MATERIEL_BATTERIE, MATERIEL_CHARGEUR } from "@/constants/vehicle";

import {
  dash,
  euros,
  hasMateriel,
  isOui,
  kilometres,
  ouiNon,
  regionLabel,
  statusLabel,
  submittedAt,
  viewerStatus,
} from "../format";

/** Just enough of a `Timestamp` for `submittedAt`, which only calls `toDate`. */
const stamp = (d: Date) => ({ toDate: () => d }) as Timestamp;

describe("dash", () => {
  test("dashes null, undefined and the empty string", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
    expect(dash("")).toBe("—");
  });

  test("keeps falsy values that are real data", () => {
    expect(dash(0)).toBe("0");
    expect(dash(false)).toBe("false");
  });

  test("stringifies anything else", () => {
    expect(dash("oui")).toBe("oui");
    expect(dash(2024)).toBe("2024");
  });
});

describe("submittedAt", () => {
  test("formats as JJ MMM AAAA hh:mm", () => {
    // Built from local parts so the assertion doesn't depend on the TZ the
    // suite happens to run in.
    expect(submittedAt(stamp(new Date(2026, 6, 26, 14, 30)))).toBe(
      "26 juil. 2026 14:30",
    );
  });

  test("pads a single-digit day and hour", () => {
    expect(submittedAt(stamp(new Date(2026, 0, 3, 9, 5)))).toBe(
      "03 janv. 2026 09:05",
    );
  });

  test("dashes a missing timestamp", () => {
    expect(submittedAt(null)).toBe("—");
    expect(submittedAt(undefined)).toBe("—");
  });
});

describe("euros / kilometres", () => {
  test("put the unit in the value", () => {
    expect(euros(2400)).toBe("2400 €");
    expect(kilometres(48000)).toBe("48000 km");
  });

  test("dash an absent number rather than render a bare unit", () => {
    expect(euros(null)).toBe("—");
    expect(kilometres(null)).toBe("—");
    expect(euros(undefined)).toBe("—");
  });

  test("keep a genuine zero", () => {
    expect(euros(0)).toBe("0 €");
    expect(kilometres(0)).toBe("0 km");
  });
});

describe("regionLabel", () => {
  test("maps both regions to French", () => {
    expect(regionLabel("NORTH")).toBe("Nord");
    expect(regionLabel("SOUTH")).toBe("Sud");
  });
});

describe("statusLabel", () => {
  test("maps every dossier status to French", () => {
    expect(statusLabel("a_traiter")).toBe("À traiter");
    expect(statusLabel("en_cours")).toBe("En cours");
    expect(statusLabel("cloture")).toBe("Clôturé");
  });
});

describe("viewerStatus", () => {
  test("hides the back office's `a_traiter` from a b2b user", () => {
    expect(viewerStatus("a_traiter", "b2b")).toBe("en_cours");
  });

  test("leaves every other b2b status alone", () => {
    expect(viewerStatus("en_cours", "b2b")).toBe("en_cours");
    expect(viewerStatus("cloture", "b2b")).toBe("cloture");
  });

  test("shows the back office the real status", () => {
    expect(viewerStatus("a_traiter", "backoffice")).toBe("a_traiter");
    expect(viewerStatus("en_cours", "backoffice")).toBe("en_cours");
    expect(viewerStatus("cloture", "backoffice")).toBe("cloture");
  });
});

describe("isOui", () => {
  test("is true only for the stored \"oui\"", () => {
    expect(isOui("oui")).toBe(true);
    expect(isOui("non")).toBe(false);
  });

  test("is false for an unanswered field", () => {
    expect(isOui(null)).toBe(false);
    expect(isOui(undefined)).toBe(false);
    expect(isOui("")).toBe(false);
  });
});

describe("ouiNon", () => {
  test("renders a derived boolean in the stored vocabulary", () => {
    expect(ouiNon(true)).toBe("oui");
    expect(ouiNon(false)).toBe("non");
  });
});

describe("hasMateriel", () => {
  test("matches the funnel's own checkbox labels", () => {
    expect(hasMateriel([MATERIEL_BATTERIE], "batterie")).toBe(true);
    expect(hasMateriel([MATERIEL_BATTERIE], "chargeur")).toBe(false);
    expect(hasMateriel([MATERIEL_BATTERIE, MATERIEL_CHARGEUR], "chargeur")).toBe(
      true,
    );
  });

  test("treats an absent list as nothing checked", () => {
    expect(hasMateriel([], "batterie")).toBe(false);
    expect(hasMateriel(null, "batterie")).toBe(false);
    expect(hasMateriel(undefined, "chargeur")).toBe(false);
  });
});
