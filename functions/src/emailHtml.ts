/**
 * The shared look of every HTML email Bike-eco sends: the B2C team and
 * customer recaps, and the back-office dossier recap. Extracted from
 * `email.ts` so a second sender cannot start a second template.
 *
 * Inline styles, not a stylesheet: mail clients strip <style> blocks.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A label/value row, dropped entirely when the value is empty/null. */
export type Row = [label: string, value: string | null | undefined];

export function rowsHtml(rows: Row[]): string {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  return visible
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:4px 12px 4px 0;color:#71727A;font-size:13px;vertical-align:top;">${esc(label)}</td>` +
        `<td style="padding:4px 0;color:#111;font-size:13px;font-weight:600;">${esc(String(value))}</td>` +
        `</tr>`
    )
    .join("");
}

export function section(title: string, rows: Row[]): string {
  const body = rowsHtml(rows);
  if (!body) return "";
  return (
    `<h2 style="font-size:15px;color:#111;margin:20px 0 6px;">${esc(title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;">${body}</table>`
  );
}

/**
 * Escaping for a value that lands inside a quoted attribute. `esc` alone is
 * enough for text, but leaves `"` untouched — which would close an `href="…"`
 * early and let the rest of the value become markup.
 */
export function escAttr(value: string): string {
  return esc(value).replace(/"/g, "&quot;");
}

/** A linked line: the visible text, and where it points. */
export type Link = [text: string, href: string];

/**
 * Same heading as `section`, one linked line per row instead of label/value
 * pairs. Empty when there is nothing to link, so the heading never stands
 * alone above a blank block.
 */
export function linkSection(title: string, links: Link[]): string {
  if (links.length === 0) return "";
  const rows = links
    .map(
      ([text, href]) =>
        `<tr>` +
        `<td style="padding:4px 0;font-size:13px;">` +
        `<a href="${escAttr(href)}" style="color:#2A2933;font-weight:600;">${esc(text)}</a>` +
        `</td>` +
        `</tr>`
    )
    .join("");
  return (
    `<h2 style="font-size:15px;color:#111;margin:20px 0 6px;">${esc(title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;">${rows}</table>`
  );
}

export function shell(title: string, intro: string, body: string): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">` +
    `<h1 style="font-size:22px;color:#111;margin:0 0 8px;">${esc(title)}</h1>` +
    `<p style="font-size:14px;color:#71727A;margin:0 0 8px;">${esc(intro)}</p>` +
    body +
    `</div>`
  );
}
