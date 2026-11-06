---
created: 2026-11-06
last_updated: 2026-11-06
---

# Browser PII Lab

A proposal for a reproducible browser PII detection benchmark and an interactive local-inference demo, initiated by [Offthread](https://offthread.chat).

**Status: planning repository. There is no runnable demo, benchmark runner, or published score here yet.** The specifications below describe intended behavior, not completed features.

## The question

What does a small browser-local PII model detect beyond regular expressions, what ordinary text does it incorrectly flag, and how much download and waiting time does it cost?

The first comparison will evaluate three configurations on the same versioned corpus:

1. Regex only.
2. Local model only.
3. Regex plus local model, with explicit overlap-resolution rules.

## Proposed demo

Enter synthetic text, compare detected spans and redacted output, and inspect loading and inference timing. Inference should run in a browser Web Worker using WASM. User-entered text must not be sent to a server or captured by analytics. Model and runtime downloads still require network access and can expose ordinary connection metadata to their hosts.

The demo will show misses, false positives, unsupported categories, and loading failures. It must not describe detection as guaranteed anonymization.

## Starting point

Offthread currently uses `gravitee-io/bert-small-pii-detection` at revision `f8c27a85c51c0168f07b9dcf00265bf0a4097939`, through Transformers.js, with a quantized model file named `model.quant.onnx`. Its configuration labels the model approximately 27 MB; this repository has not independently measured transfer size.

Offthread's current worker explicitly uses WASM. Its source comments record incorrect labels with this graph on WebGPU; that is an implementation observation, not a claim about all WebGPU models.

The existing application benchmark runs model inference in Node on CPU and checks whether sensitive strings remain in redacted output. Those results must not be presented as this project's browser span-level benchmark.

## Project documents

- [Benchmark methodology](docs/benchmark-methodology.md)
- [Demo specification](docs/demo-spec.md)
- [Implementation and publication roadmap](TODO.md)
- [Contributing](CONTRIBUTING.md)

## Scope and limits

Initial implementation target: TypeScript with Bun for package management and development tooling. Browser inference remains browser-based; Bun/Node model results are not substitutes for browser measurements.

This project does not provide a chat model, a privacy certification, a general-purpose model leaderboard, or a production SDK. English, Chinese, and mixed-language behavior must be measured separately; no language support is claimed before testing.

## License and contact

Repository-authored materials are licensed under [MIT](LICENSE). Third-party model weights and datasets retain their own licenses and are not included. Verify pinned upstream licenses and preserve required notices before redistributing any assets.

Questions: contact@offthread.chat. Offthread's product context is available at [offthread.chat](https://offthread.chat); publishing this project does not establish an SEO or ranking benefit.
