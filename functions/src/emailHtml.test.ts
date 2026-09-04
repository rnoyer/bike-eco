import { describe, expect, test } from "@jest/globals";
import { esc, escAttr, linkSection, rowsHtml, section, shell } from "./emailHtml";

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

describe("escAttr", () => {
  test("also escapes the quote that would close an attribute", () => {
    expect(escAttr("a\" onclick=\"x")).toBe("a&quot; onclick=&quot;x");
  });
});

describe("linkSection", () => {
  test("renders its title above one anchor per link", () => {
    const html = linkSection("Photos du véhicule", [
      ["Photo Yamaha MT-07 n°1", "https://example.com/1.jpg?alt=media&token=abc"],
      ["Photo Yamaha MT-07 n°2", "https://example.com/2.jpg"],
    ]);
    expect(html).toContain("Photos du véhicule");
    // `&` becomes `&amp;` inside an href — the escaped form is the correct one.
    expect(html).toContain("href=\"https://example.com/1.jpg?alt=media&amp;token=abc\"");
    expect(html).toContain("Photo Yamaha MT-07 n°1");
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  test("renders nothing at all when there is no link", () => {
    expect(linkSection("Photos du véhicule", [])).toBe("");
  });

  test("escapes the text and the href", () => {
    const html = linkSection("T", [["<script>", "https://x/\"><script>"]]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
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
