---
created: 2026-11-06
last_updated: 2026-11-06
---

# Roadmap

## Open

- [ ] Expand the quality smoke corpus into independently reviewed evaluation data with template/source-family isolation and clear sampling rationale.
- [ ] Broaden the repetitive English scaling workload to varied long documents and languages; add independently annotated long-document quality tests.
- [ ] Collect more 100K repetitions on other hardware and implement repeated controlled cold/cached startup trials.
- [ ] Verify Safari and actual mobile devices; desktop mobile-size layout is not mobile inference validation.
- [ ] Investigate token alignment/chunk-boundary limitations and measure postprocessing ablations.
- [ ] Review model asset redistribution obligations and set hosting bandwidth limits before public deployment.
- [ ] Publish an Offthread technical blog article with the measured limitations; build only a minimal blog index initially.
- [ ] Track actual reuse, citations and referrals without treating stars as SEO evidence.

## Done

- [x] Publish scope, methodology, demo requirements and roadmap — 2026-11-06.
- [x] Implement a HTML/CSS/JavaScript static demo with regex, model and hybrid modes, highlighting, redaction, progress, cancellation and explicit failures — 2026-11-06.
- [x] Integrate three pinned browser WASM models and document differing labels and license provenance — 2026-11-06.
- [x] Add an independent scorer, synthetic quality fixtures, per-case JSON exports and comparison UI — 2026-11-06.
- [x] Commit deterministic short, ~4K, ~32K and ~100K-token plaintext workloads, generator and checksums — 2026-11-06.
- [x] Measure all 12 model/length combinations: 117 successful warmed requests, with failed attempts and interrupted/resumed sessions preserved — 2026-11-06.
- [x] Record whole-Chrome CPU/RSS, complete-result and first-chunk latency, actual input token counts and throughput — 2026-11-06.
- [x] Implement an interactive length/metric report, RSS traces, standalone SVG, CSV summaries and raw JSON downloads — 2026-11-06.
- [x] Pass 19 unit tests, production build, actual Chrome model/UI/privacy checks and desktop/mobile-size report checks — 2026-11-06.
- [x] Bound host/worker timeouts, preserve failed benchmark cases, avoid repeated failed downloads and support recorded-trial resumption — 2026-11-06.

## Deferred

Public SDK compatibility promises, a general model leaderboard, framework adapters, CMS, comments and a bulk SEO article program.

- [x] Replace Vite and browser TypeScript with plain HTML/CSS/JavaScript and copy-only static packaging — 2026-11-06.
