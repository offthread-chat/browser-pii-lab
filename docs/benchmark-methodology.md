---
created: 2026-11-06
last_updated: 2026-11-06
---

# Benchmark methodology — proposed v0.1

Status: scorer and browser harness implemented. The committed synthetic smoke results are exploratory; the independent corpus and controlled performance protocol below remain targets, not completed validation.

## Corpus and splits

Use synthetic identities or datasets with explicit redistribution permission. Never import customer prompts, production logs, or genuine secrets. Record provenance, license, generation procedure, annotation rules, and corpus checksum.

Keep development and final evaluation splits separate. Split by template/source family before generating variants to reduce near-duplicate leakage. Freeze thresholds and rules before running the evaluation split. If evaluation failures inform subsequent tuning, disclose that and create a new evaluation version rather than treating the old set as unseen.

Include positive and clean negative examples, ambiguous common words, partial identifiers, punctuation, repeated values, Unicode, long texts, code/log-like content, and chunk boundaries. Report English, Chinese, and mixed-language subsets independently. Synthetic data cannot establish real-world prevalence or performance.

Each record contains a stable ID, text, language, scenario, split, source metadata, and gold entities with `type`, `start`, and `end`. Offsets are zero-based UTF-16 code units with an exclusive end, matching JavaScript slicing. Annotators must validate the exact covered substring. Define category and overlap policy before labeling; review ambiguous cases separately.

## Configurations

Compare regex-only, model-only, and hybrid on identical inputs. Freeze the model revision, tokenizer, library versions, rule version, thresholds, category mapping, chunking, truncation limits, and hybrid conflict policy. The first shared categories and any excluded native model labels must be documented before scoring. Publish unsupported categories rather than silently removing hard examples.

Hybrid proposals: deduplicate identical spans and union overlapping redaction intervals; preserve original detector labels and provenance for scoring. Define deterministic type-conflict precedence before implementation and document it in the run manifest.

## Quality metrics

Primary detection metric: one-to-one exact span-and-type matching. Count matched predictions as TP, unmatched predictions as FP, unmatched gold spans as FN. Duplicate predictions cannot earn repeated credit.

- Precision = TP / (TP + FP).
- Recall = TP / (TP + FN).
- F1 = 2TP / (2TP + FP + FN).
- Report counts and per-category/per-language scores, plus micro aggregates. Report undefined denominators as null, not perfect scores.
- Report full sensitive-span coverage by the union of redaction intervals, separately from typed detection quality. Partial masking does not count as full coverage.
- Report masked non-sensitive UTF-16 units divided by all non-sensitive units, and the fraction of clean prompts changed.
- Report all-sensitive-spans-covered prompt rate and failed/skipped input counts. Failed runs must not silently disappear from denominators; expose failure-inclusive coverage as well as successful-run detection metrics.

Optional overlap metrics must be clearly secondary. They cannot replace strict results. Preserve raw per-case predictions for audit, using only the approved public corpus. Do not use substring disappearance alone as evidence of correct entity detection.

## Browser performance protocol

Separate network-cold first load, fresh-worker load with cached assets, and inference with an initialized worker. Record whether caches were actually cleared; unknown cache state must be labeled unknown. Include initialization, tokenizer work, and end-to-end detection timing separately where measurable.

Record OS, device/chip, memory if known, browser/version, backend, thread settings, cross-origin isolation, power mode, text size, asset origins, and network conditions. Record asset transfer bytes separately from decoded asset size. A missing cross-origin Resource Timing measurement is unknown, not zero bytes.

Proposed minimum per device/configuration: five independently reset cold and cached starts; five unscored inference warmups followed by thirty timed inference trials per text-length bucket. Publish every sample, sample count, median, and p95 with the percentile convention. Low-sample startup summaries must retain raw timings and must not imply population-level confidence.

Test at least desktop Chromium, Safari, and one mobile browser before claiming cross-browser behavior. Unsupported/failed devices remain in the report. CPU results from Bun/Node are a separate experiment.

## Reproduction and publication

Each result artifact must identify source commit, corpus checksum, configuration hash, model revision, dependency lockfile, seed/order, timestamps in UTC and local time with timezone, raw predictions, timings, and errors. Publish exact run instructions only after they work from a clean checkout.

Never mix previous model scores into a new run without separate provenance. No accuracy, speed, or superiority claim may appear in README or articles until traceable to committed raw artifacts. Publish limitations and representative false positives and false negatives alongside aggregate scores.

## Implemented resource and length experiment

The v0.1 profiler is available as `bun run profile`, with data generated by `bun run data:generate`. The committed plaintext files and SHA-256 manifest live under `data/`. They repeat one project-authored synthetic English unit, sized to approximately 36 / 4K / 32K / 100K tokens with the pinned Gravitee tokenizer. Every model receives the identical file; actual input counts are reported separately and include special tokens at chunk boundaries.

The pipeline validates each chunk with its own tokenizer before inference and refuses chunks exceeding 512 tokens. This extra tokenization is included in latency. The demo keeps its 20,000 UTF-16 unit cap; the explicit profiling API allows up to 2,000,000 with a 30-minute request timeout. Long input does not imply a long model context window.

Five short warmups precede measured requests. Short / 4K / 32K / 100K workloads have 30 / 5 / 3 / 1 runs. Median complete-request time, input tokens per second, first-chunk completion, and raw samples are saved. p95 is nearest rank and is withheld when fewer than 20 runs exist. First-chunk completion is an internal milestone, not a streamed result or a generated-token TTFT. Complete-result latency includes worker messaging and output transfer; per-worker inference timing includes preflight token counting, model processing and span alignment.

CPU comes from Chrome DevTools `SystemInfo.getProcessInfo`: cumulative CPU seconds across processes of an isolated Chrome instance, sampled over wall time, where one core at full utilization is 100%. Browser process observation adds overhead, and processes that start and exit entirely between samples can be missed. First-load measurements include network waits and initialization; these must not be compared as pure inference CPU.

Memory comes from `ps` RSS in KiB for those process IDs, summed and converted to MiB, at roughly 250 ms intervals plus endpoints. This includes browser/runtime memory and shared-page double counting. It is neither exclusive model memory nor JavaScript heap usage. Missing samples are null, never zero. Sampled peaks may miss short spikes. Baseline, final and peak RSS and all raw sample times are retained.

The current measured host is not reserved exclusively for benchmarking. Other applications, thermal state, fixed model execution order and network/OS caches were not controlled. No cross-device generalization or real-document accuracy claim follows from this workload. The earlier repeated cold/cached protocol remains future work; one fresh-context startup per model does not complete it.

Lengths run in increasing order within each model instance, without forcing garbage collection or resetting the worker. Download buffers and prior allocations may affect short-input RSS, and GC can reduce RSS in later long runs. Consequently memory need not grow monotonically with text length. Short-request CPU percentages cover the resource sampling window (including observer overhead), which can be substantially longer than the request itself; use the raw window duration rather than interpreting those percentages as pure model CPU utilization.

A renderer exit interrupted the original BERT base run after its first 32K trial. The cause was not established. The completed partial artifact is preserved as `results/profile-interrupted.json`; the resumed session has its own ID and profiler source hash. Results across those sessions must not be treated as uninterrupted memory-state observations. The resumed profiler version is preserved under `results/provenance/`. Current tooling has a 5-second DevTools deadline, renderer-presence monitoring and a 20-minute host request deadline in addition to the worker timeout. `bun run profile --resume` skips successful recorded trials only after checking dependency, model, configuration and corpus identity.
