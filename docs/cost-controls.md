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
