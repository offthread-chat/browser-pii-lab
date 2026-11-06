import "./style.css";
import { MODELS } from "./models";
import { CORPUS } from "./corpus";
import { ModelClient } from "./client";
import { regexDetect, hybrid, redact, intervals } from "./detection";
import { benchmark } from "./benchmark";
import { MAX_CHARS, type Span, type Mode } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><a href="https://offthread.chat">OFFTHREAD ↗</a><span>OPEN RESEARCH / v0.1</span><a href="https://github.com/offthread-chat/browser-pii-lab">GitHub ↗</a></header><main><div class="eyebrow">ON-DEVICE EXPERIMENTS</div><h1>What stays<br><em>between the lines?</em></h1><p class="intro">Compare what small local models find, what they miss, and what they cost to run. Your text is processed in this browser.</p><div class="notice"><strong>A detector, not a privacy guarantee.</strong> Models can miss sensitive information and flag ordinary words. Model downloads contact Hugging Face; runtime assets come from this site. No text analytics or server inference.</div><section><div class="section-head"><h2><span>01</span> Try the detectors</h2><span class="badge">WASM · WEB WORKER</span></div><div class="controls"><label>Detection mode<select id="mode"><option value="regex">Regex only · no model download</option><option value="model">Local model only</option><option value="hybrid">Regex + local model</option></select></label><label>Local model<select id="model">${MODELS.map((m) => `<option value="${m.key}">${m.name} · ~${m.sizeMB} MB</option>`).join("")}</select></label></div><p id="scope" class="muted"></p><label for="input">Text to inspect <span class="muted">· synthetic examples recommended · 20,000 UTF-16 units maximum</span></label><textarea id="input" spellcheck="false" rows="6"></textarea><div class="actions"><button id="detect">Inspect text</button><button id="example" class="secondary">Next example</button><button id="clear" class="secondary">Clear</button><button id="cancel" class="secondary" disabled>Cancel / unload</button></div><p id="status" role="status" aria-live="polite">Ready. Nothing has been downloaded.</p><div class="outputs"><article><h3>Detected spans</h3><div id="highlight" class="text-output">Your input will appear here.</div><ul id="entities"></ul></article><article><h3>Redacted output</h3><pre id="redacted">No result yet.</pre><p id="timing" class="muted"></p></article></div></section><section><div class="section-head"><h2><span>02</span> Compare on the same corpus</h2><span class="badge">SMOKE BENCHMARK</span></div><p>Run all three local models, or just the selected one, against 16 synthetic evaluation fixtures. Downloads total about 271 MB for all models, plus runtime and tokenizers. This small public set is not an independent holdout or a reliable model ranking.</p><p class="muted">General NER models target names, organizations and places. Full-task results also include email, phone and IP; the shared-entity view separates these differences. Model failures count as misses, never as successful regex fallback.</p><div class="actions"><button id="bench">Compare all models</button><button id="bench-one" class="secondary">Benchmark selected model</button><button id="download" class="secondary" disabled>Download results JSON</button></div><div id="summary" aria-live="polite"></div><p class="muted">Exports contain only the synthetic corpus and benchmark predictions, never the text entered above. Timing is observational, with unknown cache state; it is not a controlled speed test.</p></section><p><a href="./report.html">Explore measured CPU, memory and length-scaling results →</a></p><footer>Built by <a href="https://offthread.chat">Offthread</a> · <a href="https://github.com/offthread-chat/browser-pii-lab/blob/main/docs/benchmark-methodology.md">Methodology</a> · <a href="mailto:contact@offthread.chat">Contact</a></footer></main>`;
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>("input"),
  mode = $<HTMLSelectElement>("mode"),
  model = $<HTMLSelectElement>("model"),
  status = $("status");
const client = new ModelClient();
let busy = false,
  controller: AbortController | null = null,
  result: Awaited<ReturnType<typeof benchmark>> | null = null,
  example = 0;
input.value =
  "Sarah works at Microsoft in London. Email sarah@example.com or call +1 202-555-0148.";
function scope() {
  $("scope").textContent = MODELS.find((m) => m.key === model.value)!.scope;
  model.disabled = busy || mode.value === "regex";
}
function setBusy(value: boolean) {
  busy = value;
  for (const id of ["detect", "example", "bench", "bench-one"])
    $<HTMLButtonElement>(id).disabled = value;
  mode.disabled = value;
  input.disabled = value;
  $<HTMLButtonElement>("cancel").disabled = !value;
  scope();
}
function resetOutput() {
  $("highlight").textContent = "Your input will appear here.";
  $("entities").replaceChildren();
  $("redacted").textContent = "No result yet.";
  $("timing").textContent = "";
}
function render(text: string, spans: Span[]) {
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
    const selected = mode.value as Mode;
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
async function run(keys: string[]) {
  if (busy) return;
  setBusy(true);
  result = null;
  $<HTMLButtonElement>("download").disabled = true;
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
    const pct = (v: number | null) =>
      v === null ? "—" : `${(v * 100).toFixed(1)}%`;
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
    $<HTMLButtonElement>("download").disabled = false;
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
// Deliberate browser-test API: no transmission, same detector and benchmark path as UI.
Object.assign(window, {
  piiLab: {
    profileDetect: async (key: string, text: string) => {
      const start = performance.now();
      const r = await profileClient.detect(key, text, () => {}, true);
      return { ...r, endToEndMs: performance.now() - start };
    },
    profileReset: () => profileClient.cancel(),
    benchmark: async (keys: string[]) => {
      const c = new ModelClient();
      try {
        return await benchmark(c, keys, () => {}, new AbortController().signal);
      } finally {
        c.cancel();
      }
    },
  },
});
