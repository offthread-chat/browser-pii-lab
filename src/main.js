import { MODELS } from "./models.js";
import { CORPUS } from "./corpus.js";
import { ModelClient } from "./client.js";
import { regexDetect, hybrid, redact, intervals } from "./detection.js";
import { benchmark } from "./benchmark.js";
import { MAX_CHARS } from "./types.js";

const $ = (id) => document.getElementById(id);
const input = $("input"),
  mode = $("mode"),
  model = $("model"),
  status = $("status");
model.replaceChildren(
  ...MODELS.map((m) => new Option(`${m.name} · ~${m.sizeMB} MB`, m.key)),
);
const client = new ModelClient();
let busy = false,
  controller = null,
  result = null,
  example = 0;
input.value =
  "Sarah works at Microsoft in London. Email sarah@example.com or call +1 202-555-0148.";
function scope() {
  $("scope").textContent = MODELS.find((m) => m.key === model.value).scope;
  model.disabled = busy || mode.value === "regex";
}
function setBusy(value) {
  busy = value;
  for (const id of ["detect", "example", "bench", "bench-one"])
    $(id).disabled = value;
  mode.disabled = value;
  input.disabled = value;
  $("cancel").disabled = !value;
  scope();
}
function resetOutput() {
  $("highlight").textContent = "Your input will appear here.";
  $("entities").replaceChildren();
  $("redacted").textContent = "No result yet.";
  $("timing").textContent = "";
}
function render(text, spans) {
  const h = $("highlight");
  h.replaceChildren();
  let cursor = 0;
  for (const s of intervals(spans)) {
    h.append(document.createTextNode(text.slice(cursor, s.start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(s.start, s.end);
    h.append(mark);
    cursor = s.end;
  }
  h.append(document.createTextNode(text.slice(cursor)));
  $("entities").replaceChildren(
    ...spans.map((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.type} · ${s.source} · [${s.start}, ${s.end})${s.score === undefined ? "" : ` · score ${s.score.toFixed(3)} (uncalibrated)`}`;
      return li;
    }),
  );
  $("redacted").textContent = redact(text, spans);
}
mode.onchange = () => {
  resetOutput();
  scope();
};
model.onchange = () => {
  client.cancel();
  resetOutput();
  scope();
};
input.oninput = resetOutput;
scope();
$("detect").onclick = async () => {
  if (busy) return;
  const text = input.value;
  resetOutput();
  if (text.length > MAX_CHARS) {
    status.textContent =
      "Input exceeds 20,000 UTF-16 units. Nothing was truncated or analyzed.";
    return;
  }
  setBusy(true);
  const t = performance.now();
  status.textContent = "Running…";
  try {
    const selected = mode.value;
    let spans = regexDetect(text),
      timing = "Regex only · no model loaded";
    if (selected !== "regex") {
      const r = await client.detect(
        model.value,
        text,
        (p) => (status.textContent = `Loading / running: ${p}`),
      );
      spans = selected === "hybrid" ? hybrid(spans, r.spans) : r.spans;
      timing = `WASM · load ${r.loadMs.toFixed(0)} ms · inference ${r.inferenceMs.toFixed(0)} ms · ${r.initialized ? "existing worker" : "new worker; asset cache unknown"}`;
    }
    render(text, spans);
    $("timing").textContent =
      `${timing} · end-to-end ${(performance.now() - t).toFixed(0)} ms`;
    status.textContent = `Complete: ${spans.length} detected spans. Undetected text may still be sensitive.`;
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : "Detection failed";
  } finally {
    setBusy(false);
  }
};
$("cancel").onclick = () => {
  controller?.abort();
  client.cancel();
};
$("clear").onclick = () => {
  controller?.abort();
  client.cancel();
  input.value = "";
  resetOutput();
  status.textContent = "Text cleared; model worker released.";
};
$("example").onclick = () => {
  input.value = CORPUS[example++ % CORPUS.length].text;
  resetOutput();
};
async function run(keys) {
  if (busy) return;
  setBusy(true);
  result = null;
  $("download").disabled = true;
  $("summary").replaceChildren();
  controller = new AbortController();
  try {
    result = await benchmark(
      client,
      keys,
      (s) => (status.textContent = s),
      controller.signal,
    );
    const table = document.createElement("table");
    table.innerHTML =
      "<caption>Exact typed spans · evaluation fixtures · failures included as misses</caption><thead><tr><th>Configuration</th><th>Full precision</th><th>Full recall</th><th>Full F1</th><th>Shared NER F1</th><th>Coverage</th><th>Failures</th></tr></thead>";
    const body = document.createElement("tbody");
    const pct = (v) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
    for (const s of result.summaries) {
      const tr = document.createElement("tr");
      for (const val of [
        s.config,
        pct(s.full.precision),
        pct(s.full.recall),
        pct(s.full.f1),
        pct(s.commonEntities.f1),
        pct(s.full.coverage),
        String(s.failures),
      ]) {
        const td = document.createElement("td");
        td.textContent = val;
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    $("summary").append(table);
    $("download").disabled = false;
    status.textContent =
      "Benchmark complete. Inspect failures and raw predictions in the JSON export.";
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : "Benchmark failed";
  } finally {
    client.cancel();
    controller = null;
    setBusy(false);
  }
}
$("bench").onclick = () => run(MODELS.map((m) => m.key));
$("bench-one").onclick = () => run([model.value]);
$("download").onclick = () => {
  if (!result) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "browser-pii-benchmark.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let profileClient = new ModelClient();
Object.assign(window, {
  piiLab: {
    profileDetect: async (key, text) => {
      const start = performance.now();
      const r = await profileClient.detect(key, text, () => {}, true);
      return { ...r, endToEndMs: performance.now() - start };
    },
    profileReset: () => profileClient.cancel(),
    benchmark: async (keys) => {
      const c = new ModelClient();
      try {
        return await benchmark(c, keys, () => {}, new AbortController().signal);
      } finally {
        c.cancel();
      }
    },
  },
});
