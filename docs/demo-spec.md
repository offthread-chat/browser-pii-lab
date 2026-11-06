---
created: 2026-11-06
last_updated: 2026-11-06
---

# Browser demo specification

Status: v0.1 implemented locally and tested in desktop Chrome. Not publicly deployed. Safari and real mobile verification remain open.

## User flow

1. Start with a synthetic example and a short explanation of local inference and asset downloads.
2. Offer regex, local model, and hybrid modes. Load model assets only after an explicit user action; show progress, approximate download information, and errors.
3. Display detected spans, categories, detector source, and redacted output side by side. Render input as text, never HTML. Model scores are not calibrated probabilities.
4. Show startup and inference timing with cache/backend context. Display model errors without an automatic regex fallback.
5. Provide clear/reset and cancellation controls. User text stays in memory and is not automatically persisted or exported. Export of user-entered text requires an explicit action and a warning that the file contains that text.

## Architecture proposal

Use TypeScript and Bun tooling with a static browser application, a model Web Worker, and a separate evaluation harness using the same detector adapters. Keep detection and redaction pure where possible. A detector returns typed UTF-16 spans and provenance; benchmark scoring operates independently of the implementation.

Reuse selected Offthread logic only after reviewing dependencies, licenses, and app-specific assumptions. Do not copy the private application's environment, operational docs, telemetry, credentials, or unrelated chat code into this repository.

Pin model and runtime versions. Document model/tokenizer origins and cache behavior. Serve runtime assets from the demo origin where feasible and inventory all remaining third-party requests. No paid model API, backend text endpoint, or automatic prompt telemetry belongs in v0.1.

## Acceptance criteria

- A clean checkout can install dependencies, run locally, and build using documented Bun commands.
- Browser network inspection confirms entered text never appears in requests, URLs, telemetry, or error reports.
- Synthetic samples demonstrate all three modes, including intentional false positives and misses.
- Loading failure, cancellation, excessive input, and unsupported browser states are visible and recoverable.
- Long-input limits, truncation/chunking, and fallback behavior are documented and tested.
- Unicode offsets, overlaps, repeated identifiers, and chunk-boundary spans have meaningful correctness tests.
- UI remains responsive during inference; no model work runs on the main thread.
- Keyboard operation, labels, contrast, and narrow-screen layout are checked.
- Measurements name their actual browser/backend; no CPU benchmark is relabeled as WASM.

## Deployment and cost

Choose a static host only when the implementation is ready. No hosting or paid service is provisioned by this planning repository. Before deployment, document asset sizes, cache policy, hosting bandwidth limits/budget, and who pays for downloads. Model hosting may have usage or availability limits even when inference runs locally.

## Results visualization

`report.html` is a separate static page over committed measurements. It offers workload-length and metric selectors, numeric tables with sample counts, RSS time-series plots, first-load observations, and links to raw JSON/input files. It does not run inference or collect telemetry. The report generator also creates a standalone SVG and CSV summaries for analysis outside the browser. The profiler requires a local Chrome/OS connection; the ordinary web page cannot inspect the user's process CPU/RSS directly.
