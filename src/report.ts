import "./style.css";
import { summarize, type ProfileRun } from "./statistics";
const root = document.querySelector<HTMLDivElement>("#report")!;
root.innerHTML = `<header><a href="./">← BROWSER PII LAB</a><span>MEASURED IN CHROME / WASM</span><a href="https://github.com/offthread-chat/browser-pii-lab">SOURCE ↗</a></header><main><div class="eyebrow">MEASUREMENTS, WITH LIMITS</div><h1>Small models.<br><em>Longer inputs.</em></h1><p class="intro">Explore latency, input throughput, CPU and memory across the same synthetic workloads. These are recorded results, not a live test of your device.</p><div id="metadata" class="notice">Loading committed measurements…</div><section><div class="section-head"><h2><span>01</span> Compare by input length</h2></div><div class="controls"><label>Input workload<select id="length"><option value="short">Short · about 36 reference tokens</option><option value="4k">About 4K reference tokens</option><option value="32k">About 32K reference tokens</option><option value="100k" selected>About 100K reference tokens</option></select></label><label>Metric<select id="metric"><option value="medianMs">Complete-result latency · milliseconds ↓</option><option value="inputTokensPerSecond">Input tokens per second ↑</option><option value="cpuPercent">Chrome CPU · % of one core</option><option value="peakRssMiB">Chrome peak RSS sum · MiB</option><option value="firstChunkMs">First chunk completion · milliseconds ↓</option></select></label></div><div id="bars" style="margin:28px 0"></div><div id="details" style="overflow-x:auto"></div><p class="muted">Latency is median complete-request time. Input tokens include special tokens repeated at chunk boundaries. First chunk completion is not a streamed token or an emitted partial result. p95 is shown only with at least 20 runs; 100K has one run per model.</p></section><section><h2><span>02</span> Memory over the longest run</h2><p class="muted">OS RSS summed across the isolated Chrome processes, sampled about every 250 ms. Includes browser/runtime overhead and duplicated shared pages; not model-exclusive memory. Sizes run in increasing order without resetting the worker, so GC and earlier allocations affect later baselines. Lines have different durations.</p><div id="memory"></div></section><section><h2><span>03</span> First result from a fresh browser</h2><p>Includes weight download, initialization and detection of the short workload. Fresh browser context caches were empty, but network/CDN/OS caches were not controlled. These single observations are not a cold-start ranking.</p><div id="cold" style="overflow-x:auto"></div></section><section><h2><span>04</span> Read the evidence</h2><p>All inputs repeat one synthetic English template. Long inputs are split into many BERT-sized chunks; none of these models has a 100K context window. Resource polling adds overhead. Other apps, thermal state and model execution order can affect results. Short-request CPU includes a larger fraction of sampling overhead. Memory is not reset between lengths.</p><p><a href="./measurements.json" download>Download raw measurements JSON</a> · <a href="https://github.com/offthread-chat/browser-pii-lab/tree/main/data">Input files + checksums</a> · <a href="https://github.com/offthread-chat/browser-pii-lab/tree/main/results">Quality results + methodology</a></p></section></main>`;
const colors = ["#476a45", "#b27932", "#636fa3"];
const fmt = (n: number | null, d = 1) =>
  n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });
function table(
  container: HTMLElement,
  heads: string[],
  rows: (string | number)[][],
) {
  container.replaceChildren();
  const t = document.createElement("table"),
    h = document.createElement("thead"),
    hr = document.createElement("tr");
  for (const title of heads) {
    const th = document.createElement("th");
    th.textContent = title;
    hr.append(th);
  }
  h.append(hr);
  t.append(h);
  const b = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value of row) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    b.append(tr);
  }
  t.append(b);
  container.append(t);
}
try {
  const response = await fetch(new URL("./measurements.json", location.href));
  if (!response.ok)
    throw new Error(
      "Run bun run profile and rebuild to generate measurements.",
    );
  const data = (await response.json()) as {
    runs: ProfileRun[];
    browser: string;
    host: { cpu: string; logicalCores: number; physicalMemoryGiB: number };
    createdUTC: string;
    createdLocal: string;
    interruptions?: { reason: string }[];
    models: { key: string; name: string }[];
  };
  document.querySelector("#metadata")!.textContent =
    `${data.host.cpu} · ${data.host.logicalCores} logical cores · ${fmt(data.host.physicalMemoryGiB)} GiB RAM · Chrome ${data.browser}. Recorded ${data.createdUTC} UTC / ${data.createdLocal}. Three models tested sequentially in separate browser instances. Only this host has been measured.`;
  if (data.interruptions?.length) {
    const warning = document.createElement("p");
    warning.className = "notice";
    warning.textContent =
      "Recorded interruption: " +
      data.interruptions.map((x) => x.reason).join(" ");
    document.querySelector("#metadata")!.after(warning);
  }
  const length = document.querySelector<HTMLSelectElement>("#length")!,
    metric = document.querySelector<HTMLSelectElement>("#metric")!;
  function render() {
    const summaries = data.models.map((m) => ({
      model: m,
      ...summarize(
        data.runs.filter(
          (r) =>
            r.model === m.key &&
            r.phase === "warm" &&
            r.length === length.value,
        ),
      ),
    }));
    const key = metric.value as
      | "medianMs"
      | "inputTokensPerSecond"
      | "cpuPercent"
      | "peakRssMiB"
      | "firstChunkMs";
    const max = Math.max(1, ...summaries.map((s) => s[key] ?? 0));
    const bars = document.querySelector<HTMLElement>("#bars")!;
    bars.replaceChildren();
    for (const [i, s] of summaries.entries()) {
      const row = document.createElement("div");
      row.style.margin = "20px 0";
      const label = document.createElement("div");
      label.textContent = `${s.model.name} — ${fmt(s[key])}${s.failures ? ` (${s.failures} failed)` : ""}`;
      label.style.cssText = "font-size:13px;margin-bottom:8px";
      const track = document.createElement("div");
      track.style.cssText =
        "height:22px;background:#edf0e6;border-radius:4px;overflow:hidden";
      const fill = document.createElement("div");
      fill.style.cssText = `height:100%;width:${((s[key] ?? 0) / max) * 100}%;background:${colors[i]};border-radius:4px`;
      track.append(fill);
      row.append(label, track);
      bars.append(row);
    }
    table(
      document.querySelector("#details")!,
      [
        "Pipeline",
        "Runs / failed",
        "Actual input tokens",
        "Chunks",
        "Median ms",
        "p95 ms",
        "Tokens/s",
        "CPU %",
        "Baseline RSS MiB",
        "Peak RSS MiB",
      ],
      summaries.map((s) => [
        s.model.name,
        `${s.trials} / ${s.failures}`,
        fmt(s.tokens, 0),
        fmt(s.chunks, 0),
        fmt(s.medianMs),
        fmt(s.p95Ms),
        fmt(s.inputTokensPerSecond),
        fmt(s.cpuPercent),
        fmt(s.baselineRssMiB),
        fmt(s.peakRssMiB),
      ]),
    );
  }
  length.onchange = metric.onchange = render;
  render();
  const longest = data.models
    .map((m) =>
      data.runs.find(
        (r) =>
          r.model === m.key &&
          r.phase === "warm" &&
          r.length === "100k" &&
          !r.error,
      ),
    )
    .filter((x): x is ProfileRun => !!x);
  const w = 900,
    h = 300,
    pad = 45;
  const maxX = Math.max(
      1,
      ...longest.map((r) => r.samples.at(-1)?.elapsedMs ?? 0),
    ),
    maxY = Math.max(
      1,
      ...longest.flatMap((r) => r.samples.map((s) => s.rssMiB ?? 0)),
    );
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Chrome process RSS over time during 100K-token workloads",
  );
  svg.style.width = "100%";
  svg.style.minWidth = "680px";
  const text = (x: number, y: number, s: string) => {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y));
    t.setAttribute("fill", "#596653");
    t.setAttribute("font-size", "12");
    t.textContent = s;
    svg.append(t);
  };
  for (let i = 0; i <= 4; i++) {
    const y = h - pad - (i / 4) * (h - 2 * pad);
    const line = document.createElementNS(ns, "line");
    for (const [k, v] of Object.entries({
      x1: pad,
      y1: y,
      x2: w - pad,
      y2: y,
      stroke: "#dce2d6",
    }))
      line.setAttribute(k, String(v));
    svg.append(line);
    text(0, y, fmt((maxY * i) / 4, 0));
    text(
      pad + (i / 4) * (w - 2 * pad),
      h - 12,
      `${fmt((maxX * i) / 4 / 1000, 0)}s`,
    );
  }
  text(0, 20, "MiB");
  for (const r of longest) {
    const i = data.models.findIndex((m) => m.key === r.model);
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute(
      "points",
      r.samples
        .filter((s) => s.rssMiB !== null)
        .map(
          (s) =>
            `${pad + (s.elapsedMs / maxX) * (w - 2 * pad)},${h - pad - (s.rssMiB! / maxY) * (h - 2 * pad)}`,
        )
        .join(" "),
    );
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", colors[i]);
    poly.setAttribute("stroke-width", "2");
    svg.append(poly);
  }
  const memory = document.querySelector<HTMLElement>("#memory")!;
  memory.style.overflowX = "auto";
  memory.append(svg);
  for (const [i, m] of data.models.entries()) {
    const legend = document.createElement("span");
    legend.textContent = `● ${m.name}  `;
    legend.style.cssText = `color:${colors[i]};font-size:12px;margin-right:16px`;
    memory.append(legend);
  }
  table(
    document.querySelector("#cold")!,
    [
      "Model",
      "First complete result (ms)",
      "CPU %",
      "Peak Chrome RSS MiB",
      "Error",
    ],
    data.models.map((m) => {
      const r = data.runs.find(
        (r) => r.model === m.key && r.phase === "firstLoad",
      );
      return [
        m.name,
        fmt(r?.value?.endToEndMs ?? null),
        fmt(r?.cpuPercentOneCore ?? null),
        fmt(r?.peakRssMiB ?? null),
        r?.error ?? "none",
      ];
    }),
  );
} catch (e) {
  document.querySelector("#metadata")!.textContent =
    e instanceof Error ? e.message : "Could not load measurements";
}
