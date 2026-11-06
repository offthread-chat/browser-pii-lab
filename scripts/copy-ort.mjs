// Copies the ONNX Runtime files on-device redaction needs into public/, under a
// versioned path, so the browser loads them from this site and not from a CDN.
// The list matches the suffixes chosen in src/model.worker.js.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const dist = new URL("../node_modules/onnxruntime-web/dist/", import.meta.url);
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", dist), "utf8"),
);
const out = new URL(`../public/ort/${version}/`, import.meta.url);

mkdirSync(out, { recursive: true });
for (const name of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
]) {
  copyFileSync(new URL(name, dist), new URL(name, out));
}
console.log(`ONNX Runtime ${version} copied to public/ort/`);
