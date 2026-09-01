/**
 * Run-envelope primitives shared verbatim across harnesses.
 *
 * CANONICAL COPY. pi-sprite owns this file; app-builder holds a byte-identical
 * copy at `src/lib/runEnvelopeShared.ts`, kept honest by `scripts/check-shared-envelope.mjs`.
 * Edit here, then re-sync — never edit the copy.
 *
 * Only genuinely host-independent pieces belong here. The *record shapes* do not:
 * pi-sprite folds a two-event `run_start`/`run_end` pair from a client-side loop
 * against a hosted model, app-builder writes one record from a server-side loop
 * against local Ollama. Those differences are deliberate and documented in each
 * harness's own `runEnvelope.ts`. What must not differ is how a variant label is
 * normalized and how a manifest line is framed — a mismatch there silently
 * mis-joins runs between the two, which is exactly what happened before this file
 * existed.
 *
 * No imports: this must stay loadable from a browser bundle, a SvelteKit server
 * route, and a plain node script alike.
 */

/** Default variant when no `?variant=` is supplied — the control arm. */
export const BASELINE_VARIANT = "baseline";

/** Longest variant label accepted: descriptive enough to read, short enough to tabulate. */
export const MAX_VARIANT_LENGTH = 64;

/**
 * FNV-1a, 32-bit. Not a security primitive — it only needs to change when the
 * hashed text changes, and `crypto.subtle` is async everywhere this is called.
 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Reduce an arbitrary label to a safe variant id.
 *
 * Disallowed characters are STRIPPED, not replaced. Replacing them with `-`
 * collides: `v/plan` and `v-plan` would both become `v-plan` and their runs would
 * average together. Stripping keeps them distinct (`vplan` vs `v-plan`).
 *
 * Applied on both sides — read from the URL on the client, re-applied on the
 * server because by then the value has travelled through a request body.
 */
export function sanitizeVariant(raw: unknown): string {
  if (typeof raw !== "string") return BASELINE_VARIANT;
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, MAX_VARIANT_LENGTH);
  return cleaned || BASELINE_VARIANT;
}

/**
 * Read the experiment arm from a query string (`?variant=v-plan`).
 *
 * A URL parameter rather than a UI control on purpose: it lets a Playwright
 * driver run the same corpus against two arms with no human touching a slider.
 */
export function resolveVariant(search: string): string {
  try {
    return sanitizeVariant(new URLSearchParams(search).get("variant"));
  } catch {
    return BASELINE_VARIANT;
  }
}

/**
 * Frame one record as a manifest line, newline included.
 *
 * The trailing newline is part of the line, not a separator between lines. A
 * manifest built by joining on "\n" has no final newline, so appending to it —
 * or concatenating two of them — fuses two records into one unparseable line.
 */
export function toJsonlLine(record: unknown): string {
  return `${JSON.stringify(record)}\n`;
}

/** Frame many records as a manifest body. Always ends with a newline. */
export function toJsonl(records: readonly unknown[]): string {
  return records.map(toJsonlLine).join("");
}

/**
 * Parse a manifest back into records, skipping unparseable lines.
 *
 * Lines are skipped rather than thrown on because the manifest is append-only and
 * may be read mid-write; one torn tail line should not cost you the other two
 * hundred runs.
 */
export function parseJsonl<T>(body: string): T[] {
  const records: T[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as T);
    } catch {
      // torn or hand-edited line — keep going
    }
  }
  return records;
}
