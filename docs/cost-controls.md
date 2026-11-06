---
created: 2026-11-06
last_updated: 2026-11-06
---

# Cost and resource controls

- No paid inference provider, server API, or API key is used.
- Model assets download only after explicit detection or benchmark action. One worker/model is retained at a time and released when switching models, cancelling, clearing, or completing a benchmark.
- Each request is capped at 20,000 UTF-16 units and has a 180-second worker timeout. Inputs are rejected rather than silently shortened.
- The default comparison uses 16 fixed evaluation cases and three pinned models. It runs sequentially. No automatic background benchmarking or analytics.
- Model weights total roughly 271 MB across the three models, excluding runtime/tokenizer files. Downloads can incur the user's data charges and consume cache/storage. Runtime build output contains alternate WASM files for compatibility; not all are fetched on one load.
- Unit-test/build CI does not run model inference or download model weights. Browser tests are explicit local commands.
- No public hosting or paid infrastructure has been provisioned. Before deployment, select a bandwidth budget and asset cache policy. A public demo would incur hosting traffic for JS/runtime assets; this repository does not currently enforce a hosted bandwidth budget.

## Explicit long-input profiling

`bun run profile` is an opt-in local experiment, separate from the demo input limit. It permits at most 2,000,000 UTF-16 units per worker request and a 30-minute timeout per request. The committed longest fixture is about 400,000 UTF-16 units / 100K reference tokens. Three models run sequentially in separate temporary Chrome instances. Each model has one first-load observation, five short warmups, then 30 short, 5 4K, 3 32K and 1 100K measured runs. There is no background scheduler or paid inference. This work can keep a CPU busy for several minutes and consume substantial RAM; users start it explicitly. Tokens exceeding a chunk's 512-token cap fail rather than silently truncate.

The host-side profiler additionally caps each request at 20 minutes and each DevTools process-info request at 5 seconds. An error is saved before the run stops; `--resume` skips successful recorded trials and starts a fresh browser for remaining work. A restart changes cache and memory baselines and is recorded as a separate session.

A browser quality benchmark stops attempting a model after its first detection/load error in that run. Remaining cases are recorded as skipped failures, rather than repeatedly downloading weights. The user can explicitly start a new run to retry. This avoids up to sixteen repeated download attempts per model on an unavailable network.
