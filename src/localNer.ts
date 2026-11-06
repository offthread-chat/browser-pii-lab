import type { RedactionConfidence, RedactionType } from "./types.ts";

/**
 * On-device named-entity detection.
 *
 * A small open-weight token classifier (gravitee-io/bert-small-pii-detection,
 * Apache 2.0, ~27 MB int8) runs in a Web Worker via Transformers.js and finds
 * the identifiers the regex rules cannot: person names, organizations and
 * locations without a cue word. The model output is per-token BIO labels
 * without character offsets, so this module aligns tokens back to the source
 * text, groups them into spans and maps the model's label set onto Offthread's
 * redaction types. Everything here is pure so it can be unit-tested in Node;
 * the model itself only ever runs in the browser.
 */

export const LOCAL_NER_MODEL_ID = "gravitee-io/bert-small-pii-detection";
/** Pinned so a repo update cannot silently change what runs in users' browsers. */
export const LOCAL_NER_MODEL_REVISION =
  "f8c27a85c51c0168f07b9dcf00265bf0a4097939";
export const LOCAL_NER_MODEL_SIZE_LABEL = "27 MB";
/** Texts longer than this are left to the regex rules only. */
export const LOCAL_NER_MAX_CHARS = 20_000;
/**
 * BERT positions cap at 512 tokens. Chunks are kept well under that because
 * the estimate below is rough, especially for code and non-Latin scripts.
 */
export const LOCAL_NER_CHUNK_TOKEN_BUDGET = 320;

export type LocalNerStatus = "idle" | "loading" | "ready" | "unavailable";

export type LocalNerToken = {
  entity: string;
  score: number;
  index: number;
  word: string;
};

export type LocalNerSpan = {
  type: RedactionType;
  start: number;
  end: number;
  confidence: RedactionConfidence;
  score: number;
  label: string;
};

export type LocalNerChunk = {
  start: number;
  text: string;
};

type AlignedToken = LocalNerToken & {
  start: number;
  end: number;
};

/**
 * Model labels that map onto an existing redaction type. Labels missing here
 * are dropped: URL (too many harmless links), TITLE/HONORIFIC (not
 * identifying on their own), NRP, COORDINATE, MAC_ADDRESS, IMEI and the
 * US document numbers, for which Offthread has no placeholder type yet.
 */
const LABEL_TO_TYPE: Record<string, RedactionType> = {
  PER: "PERSON_NAME",
  ORG: "ORGANIZATION",
  LOC: "LOCATION",
  PERSON: "PERSON_NAME",
  ORGANIZATION: "ORGANIZATION",
  LOCATION: "LOCATION",
  EMAIL_ADDRESS: "EMAIL",
  PHONE_NUMBER: "PHONE",
  DATE_TIME: "DATE",
  CREDIT_CARD: "PAYMENT_CARD",
  US_SSN: "SSN",
  IP_ADDRESS: "IP_ADDRESS",
  PASSWORD: "SECRET",
  IBAN_CODE: "BANK_ACCOUNT",
  US_BANK_NUMBER: "BANK_ACCOUNT",
  AGE: "AGE",
};

const HIGH_CONFIDENCE_SCORE = 0.8;
const MEDIUM_CONFIDENCE_SCORE = 0.45;

export function mapLocalNerLabel(label: string): RedactionType | null {
  return LABEL_TO_TYPE[label] ?? null;
}

export function confidenceForScore(score: number): RedactionConfidence | null {
  if (!Number.isFinite(score)) return null;
  if (score >= HIGH_CONFIDENCE_SCORE) return "high";
  if (score >= MEDIUM_CONFIDENCE_SCORE) return "medium";
  return null;
}

/**
 * Rough token count for the uncased WordPiece tokenizer: Latin words split
 * into a piece or two, every CJK character is its own token, and punctuation
 * is split off.
 */
export function estimateLocalNerTokens(text: string): number {
  let count = 0;
  for (const match of text.matchAll(/[A-Za-z]+|\d+|[^\sA-Za-z\d]/gu)) {
    const token = match[0];
    if (/^[A-Za-z]+$/.test(token)) {
      count += Math.max(1, Math.ceil(token.length / 6));
    } else if (/^\d+$/.test(token)) {
      count += Math.max(1, Math.ceil(token.length / 3));
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Splits text into chunks that fit the model window, cutting at sentence or
 * line boundaries where possible. Chunk offsets are absolute so spans found
 * in a chunk can be mapped straight back to the source text.
 */
export function chunkTextForLocalNer(
  text: string,
  tokenBudget: number = LOCAL_NER_CHUNK_TOKEN_BUDGET,
): LocalNerChunk[] {
  if (text.trim().length === 0) return [];
  if (estimateLocalNerTokens(text) <= tokenBudget) {
    return [{ start: 0, text }];
  }

  const chunks: LocalNerChunk[] = [];
  let current: LocalNerChunk | null = null;

  const push = (segment: LocalNerChunk) => {
    if (segment.text.trim().length === 0) {
      if (current) current.text += segment.text;
      return;
    }
    if (
      current &&
      estimateLocalNerTokens(current.text + segment.text) <= tokenBudget
    ) {
      current.text += segment.text;
      return;
    }
    if (current) chunks.push(current);
    current = { ...segment };
  };

  for (const sentence of splitSentences(text)) {
    if (estimateLocalNerTokens(sentence.text) <= tokenBudget) {
      push(sentence);
      continue;
    }
    for (const piece of splitByBudget(sentence, tokenBudget)) {
      push(piece);
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((chunk) => chunk.text.trim().length > 0);
}

function splitSentences(text: string): LocalNerChunk[] {
  const segments: LocalNerChunk[] = [];
  const boundary = /[^\n.!?。！？]*(?:[.!?。！？]+|\n+|$)\s*/gu;
  let cursor = 0;

  for (const match of text.matchAll(boundary)) {
    if (match[0].length === 0) continue;
    segments.push({ start: match.index, text: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ start: cursor, text: text.slice(cursor) });
  }

  return segments;
}

function splitByBudget(
  segment: LocalNerChunk,
  tokenBudget: number,
): LocalNerChunk[] {
  const pieces: LocalNerChunk[] = [];
  let current = "";
  let currentStart = segment.start;

  const flush = () => {
    if (current.length > 0) {
      pieces.push({ start: currentStart, text: current });
    }
    current = "";
  };

  for (const match of segment.text.matchAll(/\S+\s*|\s+/gu)) {
    let word = match[0];
    let wordStart = segment.start + match.index;

    // A single oversized token (minified code, a long CJK run) is cut by
    // characters as a last resort.
    while (estimateLocalNerTokens(word) > tokenBudget) {
      let cut = word.length;
      while (
        cut > 1 &&
        estimateLocalNerTokens(word.slice(0, cut)) > tokenBudget
      ) {
        cut = Math.floor(cut / 2);
      }
      const head = word.slice(0, cut);
      if (current.length > 0) flush();
      pieces.push({ start: wordStart, text: head });
      word = word.slice(cut);
      wordStart += cut;
    }
    if (word.length === 0) continue;

    if (estimateLocalNerTokens(current + word) > tokenBudget) {
      flush();
      currentStart = wordStart;
    } else if (current.length === 0) {
      currentStart = wordStart;
    }
    current += word;
  }

  flush();
  return pieces;
}

/**
 * Normalizes text the way BERT's uncased basic tokenizer does (lowercase,
 * accents stripped) while remembering which source index each normalized
 * character came from.
 */
export function normalizeForTokenAlignment(text: string): {
  normalized: string;
  sourceIndex: number[];
} {
  let normalized = "";
  const sourceIndex: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const folded = char.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    for (const produced of folded) {
      normalized += produced;
      sourceIndex.push(index);
    }
  }

  return { normalized, sourceIndex };
}

/**
 * Recovers character offsets for pipeline tokens by walking them through the
 * normalized source text in order. Tokens that cannot be located (for
 * example pieces of an [UNK] word) are skipped rather than guessed.
 */
export function alignTokensToText(
  text: string,
  tokens: LocalNerToken[],
): AlignedToken[] {
  const { normalized, sourceIndex } = normalizeForTokenAlignment(text);
  const aligned: AlignedToken[] = [];
  let cursor = 0;

  for (const token of tokens) {
    const piece = tokenPiece(token.word);
    if (!piece) continue;

    const position = normalized.indexOf(piece, cursor);
    if (position < 0) continue;

    const start = sourceIndex[position];
    const end = sourceIndex[position + piece.length - 1] + 1;
    cursor = position + piece.length;
    aligned.push({ ...token, start, end });
  }

  return aligned;
}

function tokenPiece(word: string): string | null {
  const trimmed = word.trim();
  if (!trimmed || trimmed === "[UNK]") return null;
  const piece = trimmed.startsWith("##") ? trimmed.slice(2) : trimmed;
  return piece.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Groups BIO-tagged tokens into entity spans. A group continues only through
 * consecutive tokens with an I- tag of the same type; anything else starts a
 * new group, matching the "simple" aggregation strategy.
 */
export function groupLocalNerTokens(
  text: string,
  tokens: LocalNerToken[],
  offset: number = 0,
): LocalNerSpan[] {
  const aligned = alignTokensToText(text, tokens);
  const groups: Array<{
    tag: string;
    start: number;
    end: number;
    scores: number[];
    lastIndex: number;
  }> = [];

  for (const token of aligned) {
    const [prefix, tag] = splitBioLabel(token.entity);
    if (tag === "O") continue;

    const open = groups[groups.length - 1];
    const continues =
      open !== undefined &&
      open.tag === tag &&
      prefix !== "B" &&
      token.index === open.lastIndex + 1;

    if (continues) {
      open.end = token.end;
      open.scores.push(token.score);
      open.lastIndex = token.index;
      continue;
    }

    groups.push({
      tag,
      start: token.start,
      end: token.end,
      scores: [token.score],
      lastIndex: token.index,
    });
  }

  const spans: LocalNerSpan[] = [];

  for (const group of groups) {
    const type = mapLocalNerLabel(group.tag);
    if (!type) continue;

    const trimmed = trimSpan(text, group.start, group.end);
    if (!trimmed) continue;

    const value = text.slice(trimmed.start, trimmed.end);
    if (!isPlausibleEntityValue(value)) continue;
    if (
      JOINABLE_TYPES.has(type) &&
      cutsThroughWord(text, trimmed.start, trimmed.end)
    ) {
      continue;
    }
    if (!matchesTypeShape(type, value)) continue;

    const score =
      group.scores.reduce((total, item) => total + item, 0) /
      group.scores.length;
    const confidence = confidenceForScore(score);
    if (!confidence) continue;

    spans.push({
      type,
      start: offset + trimmed.start,
      end: offset + trimmed.end,
      confidence,
      score,
      label: group.tag,
    });
  }

  return joinAdjacentNameSpans(spans, text, offset).map((span) =>
    capUncasedFreeText(span, text, offset),
  );
}

const JOINABLE_TYPES = new Set<RedactionType>([
  "PERSON_NAME",
  "ORGANIZATION",
  "LOCATION",
]);

/**
 * The model sometimes restarts an entity mid-name ("Daniel" B-PERSON,
 * "Okafor" B-PERSON). Two spans of the same free-text type separated only by
 * a single space are one identifier, so they are joined.
 */
function joinAdjacentNameSpans(
  spans: LocalNerSpan[],
  text: string,
  offset: number,
): LocalNerSpan[] {
  const joined: LocalNerSpan[] = [];

  for (const span of spans) {
    const previous = joined[joined.length - 1];
    const gap =
      previous !== undefined
        ? text.slice(previous.end - offset, span.start - offset)
        : null;

    if (
      previous !== undefined &&
      previous.type === span.type &&
      JOINABLE_TYPES.has(span.type) &&
      gap === " "
    ) {
      const length = previous.end - previous.start;
      const added = span.end - span.start;
      const score =
        (previous.score * length + span.score * added) / (length + added);
      const confidence = confidenceForScore(score) ?? previous.confidence;
      joined[joined.length - 1] = {
        ...previous,
        end: span.end,
        score,
        confidence,
      };
      continue;
    }

    joined.push(span);
  }

  return joined;
}

/**
 * A name, organisation or place that starts or ends mid-word is a subword
 * fragment the model labelled on its own (the "ku" of "haiku"). Secrets
 * are not checked: part of a key is still worth hiding. Only cased scripts
 * are checked, since CJK text has no spaces between words.
 */
function cutsThroughWord(text: string, start: number, end: number): boolean {
  const wordChar = /[\p{Lu}\p{Ll}\p{N}]/u;
  return (
    (start > 0 &&
      wordChar.test(text[start - 1]) &&
      wordChar.test(text[start])) ||
    (end < text.length &&
      wordChar.test(text[end - 1]) &&
      wordChar.test(text[end]))
  );
}

/**
 * The model tags ordinary lowercase words as names ("Reply with one word:
 * pong" scores 0.93 PERSON). Written names, organisations and places are
 * nearly always capitalised, so a single all-lowercase word is held at
 * medium: strict mode still redacts it, standard mode leaves it alone.
 * Multi-word spans ("john smith") keep their score, and scripts without
 * case (CJK, Arabic, ...) are unaffected.
 */
function capUncasedFreeText(
  span: LocalNerSpan,
  text: string,
  offset: number,
): LocalNerSpan {
  if (span.confidence !== "high" || !JOINABLE_TYPES.has(span.type)) return span;
  const value = text.slice(span.start - offset, span.end - offset);
  const hasCasedLetter = value.toLowerCase() !== value.toUpperCase();
  if (!hasCasedLetter || value !== value.toLowerCase() || /\s/.test(value)) {
    return span;
  }
  return { ...span, confidence: "medium" };
}

function splitBioLabel(entity: string): [string, string] {
  if (entity.length > 2 && entity[1] === "-") {
    return [entity[0], entity.slice(2)];
  }
  return ["I", entity];
}

function trimSpan(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  let from = start;
  let to = end;

  while (from < to && /[\s([{"'“‘]/u.test(text[from])) from += 1;
  while (to > from && /[\s,.;:!?)\]}"'”’]/u.test(text[to - 1])) to -= 1;

  return to > from ? { start: from, end: to } : null;
}

/**
 * Structured types have an obvious shape. The model occasionally labels a
 * neighbouring word (for example "cc" before an email address), and these
 * checks drop such spans without touching the free-text types.
 */
function matchesTypeShape(type: RedactionType, value: string): boolean {
  const digits = value.replace(/\D/g, "").length;

  switch (type) {
    case "EMAIL":
      return value.includes("@");
    case "PHONE":
      return digits >= 7;
    case "PAYMENT_CARD":
      return digits >= 12;
    case "SSN":
      return digits >= 9;
    case "IP_ADDRESS":
      return /^[\d.:a-f]+$/i.test(value) && digits >= 4;
    case "BANK_ACCOUNT":
      return digits >= 4;
    case "AGE":
      return /\d/.test(value);
    default:
      return true;
  }
}

function isPlausibleEntityValue(value: string): boolean {
  // Single Latin characters and lone punctuation are tokenizer noise, not
  // identifiers. Single CJK characters are too ambiguous to redact on their
  // own as well.
  if (value.length < 2) return false;
  return /[\p{L}\p{N}]/u.test(value);
}

/**
 * Merges spans from several chunks, dropping exact duplicates and keeping
 * the higher-scoring span when two overlap.
 */
export function mergeLocalNerSpans(spans: LocalNerSpan[]): LocalNerSpan[] {
  const ranked = [...spans].sort(
    (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start),
  );
  const accepted: LocalNerSpan[] = [];

  for (const span of ranked) {
    if (
      accepted.some(
        (current) => current.start < span.end && span.start < current.end,
      )
    ) {
      continue;
    }
    accepted.push(span);
  }

  return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
}
