export const MAX_CHARS = 20000;
export function validateSpans(text, spans) {
  for (const s of spans)
    if (
      !Number.isInteger(s.start) ||
      !Number.isInteger(s.end) ||
      s.start < 0 ||
      s.end <= s.start ||
      s.end > text.length
    )
      throw new Error("Invalid UTF-16 span");
}
