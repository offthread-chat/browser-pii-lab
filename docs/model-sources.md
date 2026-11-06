---
created: 2026-11-06
last_updated: 2026-11-06
---

# Model sources and attribution

## Compared models

- `gravitee-io/bert-small-pii-detection`, revision `f8c27a85c51c0168f07b9dcf00265bf0a4097939`. [Pinned model card](https://huggingface.co/gravitee-io/bert-small-pii-detection/blob/f8c27a85c51c0168f07b9dcf00265bf0a4097939/README.md) declares Apache-2.0 and English. The root file `model.quant.onnx` is already quantized; the loader's `dtype: fp32` selects its filename without adding a quantization suffix and does not dequantize the stored graph.
- `Xenova/bert-base-NER`, revision `8e892123e8b7c2c0c2bd1dcb598b7d244c4e53aa`. [Pinned model card](https://huggingface.co/Xenova/bert-base-NER/blob/8e892123e8b7c2c0c2bd1dcb598b7d244c4e53aa/README.md) declares MIT; conversion of dslim/bert-base-NER. Quantized ONNX file: 108,952,255 bytes according to Hub metadata. PER/ORG/LOC labels map to the shared taxonomy; MISC is excluded.
- `Xenova/distilbert-base-multilingual-cased-ner-hrl`, revision `c2a4dbf593c57f47004c5bc2d3770d311aee9c43`. [Pinned conversion card](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl/blob/c2a4dbf593c57f47004c5bc2d3770d311aee9c43/README.md) identifies the Davlan upstream. Its [upstream card](https://huggingface.co/Davlan/distilbert-base-multilingual-cased-ner-hrl/blob/d421f57d5b1d36b375408588669e9340f9b11a89/README.md) declares AFL-3.0 and ten languages including Chinese. The conversion metadata does not separately declare a license; do not assume the repository MIT license applies to these weights. Quantized ONNX file: 135,359,829 bytes according to Hub metadata.

No model weights are redistributed in Git. Assets are fetched directly from pinned Hub revisions on explicit use. Hosting or repackaging weights requires preserving applicable upstream licensing obligations and reviewing conversion provenance.

## Shared postprocessing

`src/localNer.js` is adapted from Offthread source commit `9fbb696d9e7355bbb8f8992493235f95e0ffa60e`, contributed here by the project owner. It now uses standalone types and maps PER/ORG/LOC aliases. Its shared heuristics include WordPiece alignment, score thresholds (minimum 0.45), shape checks, name joining and overlap selection. It may favor or disadvantage particular model tokenization/label schemes. The comparison is therefore of this complete adapter pipeline.

All models use the WASM backend with one thread. Offthread source comments record incorrect labels for its quantized PII graph on WebGPU; this experiment does not establish that all WebGPU models are incorrect. No WebGPU results are reported.

## Runtime dependencies

Transformers.js is Apache-2.0; ONNX Runtime is MIT. Build output includes applicable runtime notices in `THIRD_PARTY_NOTICES.txt`. Dependencies remain governed by their own licenses; the repository license does not relicense them.
