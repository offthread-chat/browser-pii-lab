export type RedactionType =
  | "ADDRESS"
  | "AGE"
  | "BANK_ACCOUNT"
  | "DATE"
  | "EMAIL"
  | "IP_ADDRESS"
  | "LOCATION"
  | "ORGANIZATION"
  | "PAYMENT_CARD"
  | "PERSON_NAME"
  | "PHONE"
  | "SECRET"
  | "SSN";
export type RedactionConfidence = "high" | "medium" | "low";
export type Span = {
  start: number;
  end: number;
  type: string;
  source?: string;
  score?: number;
};
export type Mode = "regex" | "model" | "hybrid";
export type Case = {
  id: string;
  text: string;
  language: string;
  split: "development" | "evaluation";
  entities: Span[];
};
export const MAX_CHARS = 20000;
export function validateSpans(text: string, spans: Span[]) {
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
