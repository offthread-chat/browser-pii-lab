import type { Case, Span } from "./types";
// Synthetic fixtures authored for this project. Not a representative or blind test set.
function item(
  id: string,
  language: string,
  split: Case["split"],
  text: string,
  labels: [string, string][],
): Case {
  const entities: Span[] = [];
  for (const [value, type] of labels) {
    let cursor = 0;
    while (true) {
      const start = text.indexOf(value, cursor);
      if (start < 0) break;
      entities.push({ start, end: start + value.length, type });
      cursor = start + value.length;
    }
  }
  return {
    id,
    language,
    split,
    text,
    entities: entities.sort((a, b) => a.start - b.start),
  };
}
export const CORPUS: Case[] = [
  item(
    "dev-email",
    "en",
    "development",
    "Email mira@example.com for a synthetic example.",
    [["mira@example.com", "EMAIL"]],
  ),
  item("dev-person", "en", "development", "My name is Daniel Okafor.", [
    ["Daniel Okafor", "PERSON_NAME"],
  ]),
  item(
    "dev-place",
    "en",
    "development",
    "Sarah works at Microsoft in London.",
    [
      ["Sarah", "PERSON_NAME"],
      ["Microsoft", "ORGANIZATION"],
      ["London", "LOCATION"],
    ],
  ),
  item("dev-phone", "en", "development", "Call +1 202-555-0148.", [
    ["+1 202-555-0148", "PHONE"],
  ]),
  item("dev-clean", "en", "development", "Reply with one word: pong.", []),
  item(
    "dev-zh",
    "zh",
    "development",
    "联系人是王小明，邮箱是 test@example.com。",
    [
      ["王小明", "PERSON_NAME"],
      ["test@example.com", "EMAIL"],
    ],
  ),
  item(
    "eval-ticket",
    "en",
    "evaluation",
    "Ticket owner: Elena Vasquez. Contact: elena@example.org.",
    [
      ["Elena Vasquez", "PERSON_NAME"],
      ["elena@example.org", "EMAIL"],
    ],
  ),
  item(
    "eval-visit",
    "en",
    "evaluation",
    "Omar Hassan visited Berlin yesterday.",
    [
      ["Omar Hassan", "PERSON_NAME"],
      ["Berlin", "LOCATION"],
    ],
  ),
  item("eval-employer", "en", "evaluation", "Priya Sharma joined Google.", [
    ["Priya Sharma", "PERSON_NAME"],
    ["Google", "ORGANIZATION"],
  ]),
  item(
    "eval-repeated",
    "en",
    "evaluation",
    "noah@example.net; please reply to noah@example.net.",
    [["noah@example.net", "EMAIL"]],
  ),
  item(
    "eval-emoji",
    "mixed",
    "evaluation",
    "🧪 测试 contact: ivy@example.com",
    [["ivy@example.com", "EMAIL"]],
  ),
  item(
    "eval-log",
    "en",
    "evaluation",
    "Synthetic log: remote=192.0.2.18 user=ops@example.org",
    [
      ["192.0.2.18", "IP_ADDRESS"],
      ["ops@example.org", "EMAIL"],
    ],
  ),
  item(
    "eval-callback",
    "en",
    "evaluation",
    "Callback number (202) 555-0199 is fictional.",
    [["(202) 555-0199", "PHONE"]],
  ),
  item("eval-zh-name", "zh", "evaluation", "请把这份材料交给李晓明。", [
    ["李晓明", "PERSON_NAME"],
  ]),
  item("eval-zh-place", "zh", "evaluation", "陈小雨在上海工作。", [
    ["陈小雨", "PERSON_NAME"],
    ["上海", "LOCATION"],
  ]),
  item("eval-fr", "fr", "evaluation", "Marie Dupont travaille à Paris.", [
    ["Marie Dupont", "PERSON_NAME"],
    ["Paris", "LOCATION"],
  ]),
  item(
    "eval-clean-prose",
    "en",
    "evaluation",
    "Summarize the advantages of unit tests.",
    [],
  ),
  item(
    "eval-clean-code",
    "en",
    "evaluation",
    "const total = prices.reduce((a, b) => a + b, 0);",
    [],
  ),
  item(
    "eval-clean-ip",
    "en",
    "evaluation",
    "Version 999.123.456.789 is not an IPv4 address.",
    [],
  ),
  item("eval-clean-zh", "zh", "evaluation", "请解释这个函数的作用。", []),
  item(
    "eval-clean-ambiguous",
    "en",
    "evaluation",
    "May I march into the room?",
    [],
  ),
  item(
    "eval-mixed",
    "mixed",
    "evaluation",
    "负责人 Alice Morgan，地址 Tokyo。",
    [
      ["Alice Morgan", "PERSON_NAME"],
      ["Tokyo", "LOCATION"],
    ],
  ),
];
export const CORPUS_INFO = {
  version: "synthetic-smoke-v1",
  license: "MIT",
  provenance:
    "Project-authored synthetic fixtures; public organization/place names are context, not personal records.",
  limitation:
    "Small engineering smoke corpus, not a validated independent holdout. Evaluation fixtures were visible during implementation; no statistical superiority or language-support claim.",
};
