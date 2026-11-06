import { validateSpans } from "./types.js";
export function regexDetect(text) {
  const rules = [
    ["EMAIL", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ["PHONE", /(?<!\w)(?:\+1[ -]?)?\(?\d{3}\)?[ -]\d{3}[ -]\d{4}(?!\w)/g],
    ["IP_ADDRESS", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ];
  return rules.flatMap(([type, regex]) =>
    [...text.matchAll(regex)]
      .filter(
        (m) => type !== "IP_ADDRESS" || m[0].split(".").every((v) => +v <= 255),
      )
      .map((m) => ({
        type,
        start: m.index,
        end: m.index + m[0].length,
        source: "regex",
      })),
  );
}
export function hybrid(regex, model) {
  const seen = new Set();
  return [...regex, ...model]
    .filter((s) => {
      const key = `${s.start}:${s.end}:${s.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.start - b.start || a.end - b.end || a.type.localeCompare(b.type),
    );
}
export function intervals(spans) {
  const out = [];
  for (const s of [...spans].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  )) {
    const prev = out.at(-1);
    if (prev && s.start <= prev.end) prev.end = Math.max(prev.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}
export function redact(text, spans) {
  validateSpans(text, spans);
  let out = "",
    cursor = 0;
  for (const s of intervals(spans)) {
    out += text.slice(cursor, s.start) + "[REDACTED]";
    cursor = s.end;
  }
  return out + text.slice(cursor);
}
