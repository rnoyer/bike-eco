import { describe, expect, test } from "@jest/globals";
import { esc, rowsHtml, section, shell } from "./emailHtml";

describe("esc", () => {
  test("escapes the three characters that would break out of the markup", () => {
    expect(esc("<b>Tom & \"co\"</b>")).toBe("&lt;b&gt;Tom &amp; \"co\"&lt;/b&gt;");
  });
});

describe("rowsHtml", () => {
  test("renders a label and its value", () => {
    const html = rowsHtml([["Marque", "Yamaha"]]);
    expect(html).toContain("Marque");
    expect(html).toContain("Yamaha");
  });

  test("drops rows with no value", () => {
    const html = rowsHtml([
      ["Marque", "Yamaha"],
      ["Année", null],
      ["Modèle", undefined],
      ["Kilométrage", "   "],
    ]);
    expect(html).toContain("Marque");
    expect(html).not.toContain("Année");
    expect(html).not.toContain("Modèle");
    expect(html).not.toContain("Kilométrage");
  });

  test("escapes both label and value", () => {
    expect(rowsHtml([["A & B", "<script>"]])).toContain("&lt;script&gt;");
  });
});

describe("section", () => {
  test("renders its title above the rows", () => {
    const html = section("Informations véhicule", [["Marque", "Yamaha"]]);
    expect(html).toContain("Informations véhicule");
    expect(html).toContain("Yamaha");
  });

  test("renders nothing at all when every row is empty", () => {
    expect(section("Informations véhicule", [["Marque", null]])).toBe("");
  });
});

describe("shell", () => {
  test("wraps title, intro and body", () => {
    const html = shell("Titre", "Intro", "<p>corps</p>");
    expect(html).toContain("Titre");
    expect(html).toContain("Intro");
    expect(html).toContain("<p>corps</p>");
  });
});
