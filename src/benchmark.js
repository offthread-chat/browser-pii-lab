import { commit, lockHash } from "./build-info.js";
import { CORPUS, CORPUS_INFO } from "./corpus.js";
import { CONFIG, MODELS } from "./models.js";
import { regexDetect, hybrid } from "./detection.js";
import { aggregate, score } from "./scoring.js";
import { ModelClient } from "./client.js";
export const hash = async (value) =>
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
  client,
  keys,
  onProgress,
  signal,
  split = "evaluation",
) {
  const cases = CORPUS.filter((c) => c.split === split),
    rows = [];
  const loads = [];
  const record = (c, config, spans, ms, error = null) =>
    rows.push({
      id: c.id,
      language: c.language,
      config,
      spans,
      error,
      ms,
      counts: score(c.text, c.entities, spans, Boolean(error)),
      common: score(
        c.text,
        c.entities.filter((e) => CONFIG.commonTypes.includes(e.type)),
        spans.filter((e) => CONFIG.commonTypes.includes(e.type)),
        Boolean(error),
      ),
    });
  for (const c of cases) {
    if (signal.aborted) throw new Error("Benchmark cancelled");
    const t = performance.now();
    record(c, "regex", regexDetect(c.text), performance.now() - t);
  }
  for (const key of keys) {
    client.cancel();
    let modelError = null;
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
              const c = cases.find((c) => c.id === x.id);
              return score(
                c.text,
                c.entities.filter((e) => e.type === type),
                x.spans.filter((e) => e.type === type),
                Boolean(x.error),
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
    commit: commit,
    lockHash: lockHash,
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
