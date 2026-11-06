import { env, pipeline } from "../public/vendor/transformers.min.js";
import { modelFor } from "./models.js";
import {
  chunkTextForLocalNer,
  groupLocalNerTokens,
  mergeLocalNerSpans,
} from "./localNer.js";
import { MAX_CHARS } from "./types.js";
env.allowLocalModels = false;
const wasm = env.backends.onnx.wasm;
wasm.numThreads = 1;
const version = env.backends.onnx.versions?.web;
const suffix = /Version\/(\d+).*Safari/.exec(navigator.userAgent);
const variant =
  suffix && Number(suffix[1]) < 26 && !("gpu" in navigator) ? "" : ".asyncify";
const base = new URL("../", import.meta.url).href;
wasm.wasmPaths = {
  mjs: `${base}public/ort/${version}/ort-wasm-simd-threaded${variant}.mjs`,
  wasm: `${base}public/ort/${version}/ort-wasm-simd-threaded${variant}.wasm`,
};
let classifier;
self.onmessage = async (e) => {
  const { id, model, text, profile } = e.data;
  try {
    if (text.length > (profile ? 2000000 : MAX_CHARS))
      throw new Error(
        `Input exceeds ${profile ? 2000000 : MAX_CHARS} UTF-16 units; input was not truncated.`,
      );
    const m = modelFor(model),
      start = performance.now();
    const initialized = !!classifier;
    if (!classifier)
      classifier = await pipeline("token-classification", m.id, {
        revision: m.revision,
        device: "wasm",
        dtype: m.dtype,
        subfolder: m.subfolder,
        model_file_name: m.file,
        progress_callback: (p) =>
          self.postMessage({
            id,
            progress:
              "progress" in p
                ? `${Math.round(p.progress)}%`
                : "status" in p
                  ? p.status
                  : "loading",
          }),
      });
    const ready = performance.now(),
      spans = [];
    let inputTokens = 0,
      chunks = 0,
      firstChunkMs = null;
    for (const chunk of chunkTextForLocalNer(text)) {
      const count = classifier.tokenizer(chunk.text, {
        truncation: false,
        padding: false,
      }).input_ids.dims[1];
      if (count > 512)
        throw new Error(
          "A chunk exceeds 512 tokens; refusing silent tokenizer truncation.",
        );
      inputTokens += count;
      chunks++;
      const output = await classifier(chunk.text, { ignore_labels: [] });
      const tokens = Array.isArray(output[0]) ? output[0] : output;
      spans.push(...groupLocalNerTokens(chunk.text, tokens, chunk.start));
      if (firstChunkMs === null) firstChunkMs = performance.now() - start;
      self.postMessage({ id, progress: `Processed chunk ${chunks}` });
    }
    self.postMessage({
      id,
      result: {
        spans: mergeLocalNerSpans(spans).map((s) => ({ ...s, source: model })),
        loadMs: ready - start,
        inferenceMs: performance.now() - ready,
        initialized,
        inputTokens,
        chunks,
        firstChunkMs,
        resources: performance.getEntriesByType("resource").map((r) => {
          const x = r;
          return {
            url: x.name.split("?")[0],
            duration: x.duration,
            transferBytes: x.transferSize || null,
            decodedBytes: x.decodedBodySize || null,
          };
        }),
      },
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Model failed",
    });
  }
};
