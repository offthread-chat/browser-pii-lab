import { AutoTokenizer } from "@huggingface/transformers";
import { MODELS } from "../src/models";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const ref = MODELS[0];
const tokenizer = await AutoTokenizer.from_pretrained(ref.id, {
  revision: ref.revision,
});
const unit =
  "Alice Morgan works at Acme Labs in London. Email alice@example.com. ";
const count = (text: string) =>
  tokenizer(text, { truncation: false, padding: false }).input_ids.dims[1];
const perUnit = count(unit) - 2;
const manifest = [];
await mkdir("data/lengths", { recursive: true });
for (const [name, target] of [
  ["short", 32],
  ["4k", 4096],
  ["32k", 32768],
  ["100k", 100000],
] as const) {
  const repetitions = Math.max(1, Math.round((target - 2) / perUnit));
  const text = unit.repeat(repetitions).trimEnd() + "\n";
  const tokens = count(text);
  const path = `data/lengths/${name}.txt`;
  await writeFile(path, text);
  manifest.push({
    name,
    targetTokens: target,
    referenceTokens: tokens,
    utf16Units: text.length,
    repetitions,
    path,
    sha256: createHash("sha256").update(text).digest("hex"),
  });
}
await writeFile(
  "data/length-manifest.json",
  JSON.stringify(
    {
      version: 1,
      license: "MIT",
      synthetic: true,
      referenceModel: ref,
      referenceCountIncludesSpecialTokens: true,
      unit,
      note: "Repetitive synthetic throughput workload, not a quality or representative-document benchmark. Same text is used for every model; actual tokenizer counts differ. Long inputs are chunked.",
      fixtures: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(manifest);
