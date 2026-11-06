import { test, expect } from "bun:test";
import { score, aggregate } from "../src/scoring.js";
import { regexDetect, hybrid, redact } from "../src/detection.js";
import {
  alignTokensToText,
  chunkTextForLocalNer,
  groupLocalNerTokens,
} from "../src/localNer.js";
import { CORPUS } from "../src/corpus.js";
const g = { start: 2, end: 5, type: "PERSON_NAME" };
test("duplicate predictions cannot earn multiple true positives", () => {
  const s = score("x Amy", [g], [g, g]);
  expect([s.tp, s.fp, s.fn]).toEqual([1, 1, 0]);
});
test("partial masking is a miss and not full coverage", () => {
  const s = score("x Amy", [g], [{ ...g, end: 4 }]);
  expect([s.tp, s.fn, s.covered]).toEqual([0, 1, 0]);
});
test("coverage unions adjacent intervals while typed match stays strict", () => {
  const s = score(
    "x Amy",
    [g],
    [
      { ...g, end: 3 },
      { ...g, start: 3 },
    ],
  );
  expect(s.covered).toBe(1);
  expect(s.tp).toBe(0);
});
test("wrong label has coverage but no typed true positive", () => {
  const s = score("x Amy", [g], [{ ...g, type: "LOCATION" }]);
  expect(s.covered).toBe(1);
  expect(s.fp).toBe(1);
});
test("empty denominators are null", () => {
  const s = aggregate([score("plain", [], [])]);
  expect(s.precision).toBeNull();
  expect(s.recall).toBeNull();
  expect(s.f1).toBeNull();
  expect(s.cleanChanged).toBe(0);
});
test("clean false positives contribute overredaction", () => {
  const s = score("x Amy", [], [g]);
  expect(s.changedClean).toBe(1);
  expect(s.excess).toBe(3);
});
test("masking preserves surrounding UTF-16 text and joins overlaps", () => {
  expect(redact("🧪 Amy!", [{ start: 3, end: 6, type: "PERSON_NAME" }])).toBe(
    "🧪 [REDACTED]!",
  );
  expect(
    redact("abcdef", [
      { start: 1, end: 4, type: "A" },
      { start: 3, end: 5, type: "B" },
    ]),
  ).toBe("a[REDACTED]f");
});
test("bad offsets rejected", () => {
  expect(() => score("abc", [], [{ start: -1, end: 2, type: "A" }])).toThrow();
});
test("regex catches repeated emails and valid IPv4 only", () => {
  expect(
    regexDetect("x@example.com x@example.com 999.2.3.4 192.0.2.1").map(
      (s) => s.type,
    ),
  ).toEqual(["EMAIL", "EMAIL", "IP_ADDRESS"]);
});
test("hybrid deduplicates exact spans with regex provenance", () => {
  expect(
    hybrid([{ ...g, source: "regex" }], [{ ...g, source: "model" }]),
  ).toEqual([{ ...g, source: "regex" }]);
});
test("WordPiece alignment preserves accents and repeated values", () => {
  const text = "José José";
  const tokens = [
    { word: "jose", entity: "B-PER", index: 1, score: 0.99 },
    { word: "jose", entity: "B-PER", index: 2, score: 0.99 },
  ];
  expect(alignTokensToText(text, tokens).map((s) => [s.start, s.end])).toEqual([
    [0, 4],
    [5, 9],
  ]);
});
test("alternate models map PER ORG LOC labels", () => {
  expect(
    groupLocalNerTokens("Alice", [
      { word: "Alice", entity: "B-PER", index: 1, score: 0.99 },
    ])[0].type,
  ).toBe("PERSON_NAME");
});
test("chunk offsets reconstruct long input without silently truncating", () => {
  const text = "Hello world. ".repeat(1000);
  const chunks = chunkTextForLocalNer(text);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.map((c) => c.text).join("")).toBe(text);
  for (const c of chunks)
    expect(text.slice(c.start, c.start + c.text.length)).toBe(c.text);
});
test("corpus IDs and spans valid and evaluation count matches UI", () => {
  expect(new Set(CORPUS.map((c) => c.id)).size).toBe(CORPUS.length);
  expect(CORPUS.filter((c) => c.split === "evaluation").length).toBe(16);
  for (const c of CORPUS)
    expect(score(c.text, c.entities, c.entities).fn).toBe(0);
});

import { median, p95, summarize } from "../src/statistics.js";
test("statistics do not invent p95 for low sample counts", () => {
  expect(median([4, 1, 2, 3])).toBe(2.5);
  expect(p95([1, 2, 3])).toBeNull();
  expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  expect(summarize([]).medianMs).toBeNull();
});

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("committed long-input files match their manifest and preserve chunk offsets", () => {
  const m = JSON.parse(
    readFileSync(
      new URL("../data/length-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  for (const f of m.fixtures) {
    const text = readFileSync(new URL("../" + f.path, import.meta.url), "utf8");
    expect(createHash("sha256").update(text).digest("hex")).toBe(f.sha256);
    expect(text.length).toBe(f.utf16Units);
    const chunks = chunkTextForLocalNer(text);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    for (const c of chunks)
      expect(text.slice(c.start, c.start + c.text.length)).toBe(c.text);
  }
});

test("a failed request is not counted as fully covered even for clean or filtered slices", () => {
  expect(score("plain", [], [], true).allCovered).toBe(0);
  expect(score("plain", [], []).allCovered).toBe(1);
});
