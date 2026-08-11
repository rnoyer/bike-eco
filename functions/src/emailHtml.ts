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

export function shell(title: string, intro: string, body: string): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">` +
    `<h1 style="font-size:22px;color:#111;margin:0 0 8px;">${esc(title)}</h1>` +
    `<p style="font-size:14px;color:#71727A;margin:0 0 8px;">${esc(intro)}</p>` +
    body +
    `</div>`
  );
}
