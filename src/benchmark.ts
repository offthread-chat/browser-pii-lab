import { CORPUS, CORPUS_INFO } from "./corpus";
import { CONFIG, MODELS } from "./models";
import { regexDetect, hybrid } from "./detection";
import { aggregate, score } from "./scoring";
import { ModelClient } from "./client";
import type { Mode, Span } from "./types";
declare const __COMMIT__: string;
declare const __LOCK_HASH__: string;
export const hash = async (value: unknown) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function benchmark(
  client: ModelClient,
  keys: string[],
  onProgress: (s: string) => void,
  signal: AbortSignal,
  split: "development" | "evaluation" = "evaluation",
) {
  const cases = CORPUS.filter((c) => c.split === split),
    rows: {
      id: string;
      language: string;
      config: string;
      spans: Span[];
      error: string | null;
      ms: number;
      counts: ReturnType<typeof score>;
      common: ReturnType<typeof score>;
    }[] = [];
  const loads: unknown[] = [];
  const record = (
    c: (typeof cases)[number],
    config: string,
    spans: Span[],
    ms: number,
    error: string | null = null,
  ) =>
    rows.push({
      id: c.id,
      language: c.language,
      config,
      spans,
      error,
      ms,
      counts: {
        ...score(c.text, c.entities, spans),
        ...(error ? { allCovered: 0 } : {}),
      },
      common: score(
        c.text,
        c.entities.filter((e) => CONFIG.commonTypes.includes(e.type)),
        spans.filter((e) => CONFIG.commonTypes.includes(e.type)),
      ),
    });
  for (const c of cases) {
    if (signal.aborted) throw new Error("Benchmark cancelled");
    const t = performance.now();
    record(c, "regex", regexDetect(c.text), performance.now() - t);
  }
  for (const key of keys) {
    client.cancel();
    let modelError: string | null = null;
    for (const c of cases) {
      if (signal.aborted) throw new Error("Benchmark cancelled");
      if (modelError) {
        record(
          c,
          `${key}:model`,
          [],
          0,
          `Skipped after model failure: ${modelError}`,
        );
        record(
          c,
          `${key}:hybrid`,
          [],
          0,
          `Skipped after model failure: ${modelError}`,
        );
        continue;
      }
      onProgress(`${key} · ${c.id}`);
      const t = performance.now();
      try {
        const r = await client.detect(key, c.text);
        if (!r.initialized)
          loads.push({
            model: key,
            loadMs: r.loadMs,
            cacheState: "unknown",
            resources: r.resources,
          });
        record(c, `${key}:model`, r.spans, r.inferenceMs);
        record(
          c,
          `${key}:hybrid`,
          hybrid(regexDetect(c.text), r.spans),
          performance.now() - t,
        );
      } catch (e) {
        if (signal.aborted) throw e;
        const error = e instanceof Error ? e.message : "Failed";
        modelError = error;
        record(c, `${key}:model`, [], performance.now() - t, error);
        record(c, `${key}:hybrid`, [], performance.now() - t, error);
      }
    }
  }
  const summaries = [...new Set(rows.map((r) => r.config))].map((config) => {
    const r = rows.filter((r) => r.config === config);
    const types = [
      ...new Set([
        ...cases.flatMap((c) => c.entities.map((e) => e.type)),
        ...r.flatMap((x) => x.spans.map((e) => e.type)),
      ]),
    ];
    return {
      config,
      byCategory: Object.fromEntries(
        types.map((type) => [
          type,
          aggregate(
            r.map((x) => {
              const c = cases.find((c) => c.id === x.id)!;
              return score(
                c.text,
                c.entities.filter((e) => e.type === type),
                x.spans.filter((e) => e.type === type),
              );
            }),
          ),
        ]),
      ),
      failures: r.filter((x) => x.error).length,
      full: aggregate(r.map((x) => x.counts)),
      commonEntities: aggregate(r.map((x) => x.common)),
      byLanguage: Object.fromEntries(
        [...new Set(r.map((x) => x.language))].map((lang) => [
          lang,
          aggregate(r.filter((x) => x.language === lang).map((x) => x.counts)),
        ]),
      ),
    };
  });
  return {
    schemaVersion: 1,
    createdUTC: new Date().toISOString(),
    createdLocal: new Date().toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    commit: __COMMIT__,
    lockHash: __LOCK_HASH__,
    corpus: CORPUS_INFO,
    split,
    corpusHash: await hash(CORPUS),
    configHash: await hash({ CONFIG, MODELS }),
    configuration: CONFIG,
    models: MODELS.filter((m) => keys.includes(m.key)),
    environment: {
      userAgent: navigator.userAgent,
      threads: navigator.hardwareConcurrency,
      crossOriginIsolated,
    },
    timingNote:
      "Per-case observations, not controlled repeated performance trials. Hybrid first case includes initialization. Cache state unknown. No speed ranking.",
    loads,
    summaries,
    rows,
    cases,
  };
}
