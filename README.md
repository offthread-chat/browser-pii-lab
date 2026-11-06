---
created: 2026-11-06
last_updated: 2026-11-06
---

# Browser PII Lab

Run three small entity-detection models locally in your browser, compare them with regex, and inspect redacted output and reproducible benchmark exports. Built by [Offthread](https://offthread.chat).

**Working v0.1:** static demo, three pinned WASM models, regex/model/hybrid modes, synthetic benchmark, independent scorer, JSON exports, and automated tests. No hosted demo has been deployed. This is an engineering experiment, not a production anonymization guarantee or a validated model leaderboard.

## Run locally

Requires Bun 1.3.3+ and a modern browser with WebAssembly. No API key is needed.

```sh
bun install --frozen-lockfile
bun run dev
```

Open the localhost URL printed by Vite. Regex runs without downloading a model. Selecting model or hybrid mode and clicking **Inspect text** starts the selected model download. **Compare all models** runs the same synthetic evaluation cases through all configurations. **Download results JSON** exports benchmark evidence, not your custom input.

```sh
bun test
bun run build
bun run preview --port 4187 --strictPort
# In another terminal, with Google Chrome installed:
bun run test:browser
bun run benchmark
```

The last command runs browser checks and writes `results/chromium-smoke.json`. It downloads roughly 271 MB of model weights plus tokenizers/runtime on first use. Browser automation runs actual Chrome WASM inference, not Node CPU inference. It uses an isolated temporary Chrome profile, not your signed-in browser profile.

## Models

| Model | Approximate quantized weights | Purpose |
|---|---:|---|
| [Gravitee BERT small PII](https://huggingface.co/gravitee-io/bert-small-pii-detection) | 27 MB | PII-specific; model used by Offthread |
| [Xenova BERT base NER](https://huggingface.co/Xenova/bert-base-NER) | 109 MB | General person, organization, location NER |
| [Xenova multilingual DistilBERT NER](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl) | 135 MB | Multilingual person, organization, location NER |

Model revisions, filenames and quantization are pinned in `src/models.ts`. General NER models do not natively cover the full PII task. Reports separate full-task scores from shared person/organization/location scores. All use the same Offthread-derived WordPiece alignment and postprocessing; this compares these **pipelines**, not raw model quality in isolation. The regex baseline is deliberately limited to emails, North American phone formatting, and IPv4; it is not Offthread's full rule engine.

See [model sources and licenses](docs/model-sources.md) and the [measured Chromium smoke report](results/README.md).

## What's measured

- One-to-one exact span-and-type precision, recall and F1, including duplicate penalties.
- Sensitive-span coverage, over-redacted UTF-16 units, clean-input changes, and complete-coverage rate.
- Per-language and per-category breakdowns, individual predictions, failures and provenance.
- Startup and per-case inference observations. Cache state is unknown; these are **not** controlled cold/warm performance trials.

The corpus contains 6 development fixtures and 16 evaluation fixtures. Both are small, public, author-generated synthetic sets visible during implementation. They are not independent holdouts, representative language samples, or a basis for statistical superiority claims. Chinese and French cases are exploratory.

## Privacy and limits

Text inference happens in a Web Worker. No text server, analytics, local chat storage, or paid provider API is used. Model/tokenizer assets load from Hugging Face and its CDN; ordinary connection metadata reaches those services. ONNX Runtime assets are served locally. The browser may cache model assets. Clearing input unloads the worker but does not delete downloaded browser caches.

Inputs over 20,000 UTF-16 units are rejected, not silently truncated. Long inputs are chunked, so an entity crossing a chunk boundary can be missed. Unknown WordPieces can also produce alignment misses. Loading failures are displayed without silently substituting regex. Cancel terminates the worker; retry creates a new one. Detection scores are not calibrated probabilities.

Desktop Chrome was tested. A narrow viewport check is not a real mobile device test. Safari and actual mobile devices remain unverified. Asset-download and inference times depend on hardware, browser and network.

## Project map

- `src/main.ts`, `src/style.css`: static demo and results UI.
- `src/model.worker.ts`, `src/client.ts`: WASM inference, worker lifetime and cancellation.
- `src/localNer.ts`: adapted Offthread token alignment and postprocessing.
- `src/detection.ts`, `src/scoring.ts`: regex, redaction and independent metrics.
- `src/corpus.ts`, `src/benchmark.ts`: fixtures and reproducible browser run artifacts.
- [Methodology](docs/benchmark-methodology.md), [demo behavior](docs/demo-spec.md), [cost controls](docs/cost-controls.md), [roadmap](TODO.md).

Repository-authored materials are [MIT licensed](LICENSE). Model weights and dependencies retain their own licenses; weights are not committed. Contact: contact@offthread.chat.
