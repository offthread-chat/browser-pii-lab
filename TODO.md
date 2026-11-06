---
created: 2026-11-06
last_updated: 2026-11-06
---

# Roadmap

## Open

- [ ] Expand the synthetic smoke corpus into independently reviewed, versioned evaluation data with template/source-family isolation and clear sampling rationale.
- [ ] Add controlled repeated cold/cached startup and warmed inference trials; currently timings are observations only.
- [ ] Verify Safari and actual mobile devices; desktop mobile-size layout is not mobile inference validation.
- [ ] Investigate token alignment/chunk-boundary limitations and measure postprocessing ablations.
- [ ] Review model asset redistribution obligations and set hosting bandwidth limits before public deployment.
- [ ] Publish an Offthread technical blog article with the measured limitations; build only a minimal blog index initially.
- [ ] Track real reuse, citations and referrals without treating stars as SEO evidence.

## Done

- [x] Publish project scope, methodology, demo requirements and roadmap — 2026-11-06.
- [x] Implement a Bun/TypeScript static demo with regex, model and hybrid modes, highlighting, redaction, progress, cancellation and explicit failures — 2026-11-06.
- [x] Integrate three pinned browser WASM models and document their differing labels and license provenance — 2026-11-06.
- [x] Add an independent scorer, synthetic development/evaluation fixtures, per-case JSON exports and comparison UI — 2026-11-06.
- [x] Add meaningful scorer/adapter unit tests and real Chrome browser tests — 2026-11-06.

## Deferred

Public SDK compatibility promises, a general model leaderboard, framework adapters, CMS, comments and a bulk SEO article program.

## Length and resource profiling

- [x] Commit deterministic short, ~4K, ~32K and ~100K-token plaintext workloads, generator and checksums — 2026-11-06.
- [x] Implement local whole-Chrome CPU/RSS sampling and first-result / input-throughput measurements — 2026-11-06.
- [x] Implement an interactive length/metric report, memory traces and standalone SVG report generator — 2026-11-06.
- [ ] Broaden the repetitive English scaling workload to varied long documents and languages, with independent annotations; run more 100K repetitions on other hardware.
