---
created: 2026-11-06
last_updated: 2026-11-06
---

# Benchmark methodology — proposed v0.1

Status: specification; no measurements have been produced by this repository.

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
