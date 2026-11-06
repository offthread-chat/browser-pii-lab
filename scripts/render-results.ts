import { readFileSync, writeFileSync } from "node:fs";
import { summarize, type ProfileRun } from "../src/statistics.js";
const data = JSON.parse(readFileSync("public/measurements.json", "utf8"));
const quality = JSON.parse(readFileSync("results/chromium-smoke.json", "utf8"));
const sizes = ["short", "4k", "32k", "100k"];
const colors = ["#476a45", "#b27932", "#636fa3"];
const fmt = (v: number | null, d = 1) =>
  v === null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d });
const summary = (key: string, size: string) =>
  summarize(
    data.runs.filter(
      (r: ProfileRun) =>
        r.model === key && r.phase === "warm" && r.length === size,
    ),
  );
const escape = (s: unknown) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const panels = [
  {
    key: "medianMs",
    title: "Complete-result latency",
    unit: "seconds",
    factor: 0.001,
  },
  {
    key: "inputTokensPerSecond",
    title: "Input processing throughput",
    unit: "tokens / second",
    factor: 1,
  },
  {
    key: "cpuPercent",
    title: "Chrome CPU",
    unit: "% of one logical core",
    factor: 1,
  },
  {
    key: "peakRssMiB",
    title: "Chrome process RSS sum",
    unit: "MiB · shared pages may repeat",
    factor: 1,
  },
] as const;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="960" viewBox="0 0 1200 960"><rect width="1200" height="960" fill="#f4f5ef"/><g font-family="Arial,sans-serif" fill="#23342b"><text x="40" y="48" font-size="28" font-weight="bold">Browser PII Lab · length scaling</text><text x="40" y="77" font-size="13">${escape(data.host.cpu)} · Chrome ${escape(data.browser)} · WASM / one thread · repetitive synthetic English input</text>`;
data.models.forEach(
  (m: any, i: number) =>
    (svg += `<circle cx="${47 + i * 370}" cy="106" r="5" fill="${colors[i]}"/><text x="${60 + i * 370}" y="111" font-size="13">${escape(m.name)}</text>`),
);
for (const [pi, panel] of panels.entries()) {
  const ox = 40 + (pi % 2) * 580,
    oy = 145 + Math.floor(pi / 2) * 365,
    pw = 540,
    ph = 320;
  svg += `<rect x="${ox}" y="${oy}" width="${pw}" height="${ph}" rx="10" fill="#fffef9" stroke="#d7ddcf"/><text x="${ox + 20}" y="${oy + 28}" font-size="18" font-weight="bold">${panel.title}</text><text x="${ox + 20}" y="${oy + 48}" font-size="12" fill="#657260">${panel.unit}</text>`;
  const values = data.models.flatMap((m: any) =>
    sizes.map((size) => {
      const s = summary(m.key, size);
      return (s[panel.key] ?? 0) * panel.factor;
    }),
  );
  const max = Math.max(1, ...values) * 1.18;
  const left = ox + 65,
    top = oy + 72,
    bottom = oy + 262,
    width = 420,
    height = 190;
  const referenceCounts = sizes.map(
    (size) =>
      data.corpus.fixtures.find((f: any) => f.name === size)
        .referenceTokens as number,
  );
  const xAt = (i: number) =>
    left +
    (Math.log(referenceCounts[i] / referenceCounts[0]) /
      Math.log(referenceCounts.at(-1)! / referenceCounts[0])) *
      width;
  for (let k = 0; k <= 4; k++) {
    const y = bottom - (k / 4) * height;
    svg += `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="#e3e7db"/><text x="${left - 10}" y="${y + 4}" text-anchor="end" font-size="11">${fmt((max * k) / 4, 0)}</text>`;
  }
  sizes.forEach(
    (size, i) =>
      (svg += `<text x="${xAt(i)}" y="${bottom + 22}" text-anchor="middle" font-size="12">${size === "short" ? "36" : size.toUpperCase()}</text>`),
  );
  svg += `<text x="${left}" y="${bottom + 43}" font-size="11" fill="#657260">Reference tokens (log axis) · completed runs: 30 / 5 / 3 / 1</text>`;
  data.models.forEach((m: any, mi: number) => {
    const pts = sizes.map((size, i) => {
      const s = summary(m.key, size);
      const v = s[panel.key];
      return {
        x: xAt(i),
        y: bottom - (((v ?? 0) * panel.factor) / max) * height,
        v: v === null ? null : v * panel.factor,
      };
    });
    svg += `<polyline fill="none" stroke="${colors[mi]}" stroke-width="2" points="${pts
      .filter((p) => p.v !== null)
      .map((p) => `${p.x},${p.y}`)
      .join(" ")}"/>`;
    for (const p of pts)
      if (p.v !== null)
        svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${colors[mi]}"><title>${escape(m.name)}: ${fmt(p.v)}</title></circle>`;
  });
}
svg += `<text x="40" y="908" font-size="13">Latency and throughput: medians. Memory: largest sampled RSS sum. CPU includes all isolated Chrome processes.</text><text x="40" y="930" font-size="13">One host, fixed execution order, synthetic repetition. No generation TTFT; 100K input is chunked, not a 100K context window.</text></g></svg>`;
writeFileSync("results/scaling.svg", svg + "\n");
let md = `---\ncreated: 2026-11-06\nlast_updated: 2026-11-06\n---\n\n# Measured results\n\nMeasured locally in Chrome ${data.browser} on ${data.host.cpu} (${data.host.logicalCores} logical cores, ${fmt(data.host.physicalMemoryGiB)} GiB RAM). Resource run began ${data.createdUTC} UTC / ${data.createdLocal}. Inference source commit: \`${data.commit}\`.\n\n![Length scaling](scaling.svg)\n\nFor the interactive view, run the app and open [report.html](../report.html). It lets you select input length and metric and inspect memory traces. Raw resource data: [measurements.json](../public/measurements.json). Inputs and checksums: [data](../data).\n\n## Length scaling\n\nThe same synthetic English file is used for each model. Actual per-model input tokens include special tokens for each chunk and therefore differ from the whole-document reference token count. All rows below are warmed model runs; first-download observations are separate in the JSON and interactive report.\n\n| Model | Reference size | Completed / failed | Actual tokens | Chunks | Median complete ms | p95 ms | Input tokens/s | CPU % | Baseline RSS MiB | Peak RSS MiB |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const m of data.models)
  for (const size of sizes) {
    const s = summary(m.key, size);
    md += `| ${m.key} | ${size} | ${s.successful} / ${s.failures} | ${fmt(s.tokens, 0)} | ${fmt(s.chunks, 0)} | ${fmt(s.medianMs)} | ${fmt(s.p95Ms)} | ${fmt(s.inputTokensPerSecond)} | ${fmt(s.cpuPercent)} | ${fmt(s.baselineRssMiB)} | ${fmt(s.peakRssMiB)} |\n`;
  }
md += `\nCPU 100% means one logical core; this is whole-Chrome CPU, not model-exclusive CPU. RSS sums can double-count shared pages and include browser/runtime overhead. Peaks are sampled, not guaranteed maxima. The worker is not reset between increasing lengths; GC and prior allocations can lower or raise later RSS baselines. Short-request CPU is especially sensitive to measurement overhead. p95 uses nearest rank and is omitted below 20 observations.\n\n## Detection quality smoke test\n\nSource commit: \`${quality.commit}\`. [Raw predictions, provenance and per-category/language scores](chromium-smoke.json). Only 16 public synthetic fixtures; these were visible during implementation and are not an independent holdout. Full-task scores include email/phone/IP; shared scores include only person/organization/location. All adapters share Offthread postprocessing.\n\n| Configuration | Full precision | Full recall | Full F1 | Shared NER F1 | Failures |\n|---|---:|---:|---:|---:|---:|\n`;
for (const s of quality.summaries)
  md += `| ${s.config} | ${fmt(s.full.precision === null ? null : s.full.precision * 100)}% | ${fmt(s.full.recall === null ? null : s.full.recall * 100)}% | ${fmt(s.full.f1 === null ? null : s.full.f1 * 100)}% | ${fmt(s.commonEntities.f1 === null ? null : s.commonEntities.f1 * 100)}% | ${s.failures} |\n`;
md += `\n## Interpretation limits\n\n- These BERT models return classified spans rather than streaming generated tokens. Complete-result latency and first-chunk completion are not generation TTFT. Tokens/s is input processing throughput.\n- Long inputs are chunked. The 100K tier is one complete run per model, not a p95 estimate or evidence of a 100K context window.\n- Resource measurements were sequential on one host with fixed model/length order. Other applications, thermal state, and filesystem/network caches were not controlled. Browser process sampling adds overhead.\n- The long corpus is deliberately repetitive and includes only one English template. It tests scaling and plumbing, not long-document accuracy, varied languages or realistic privacy coverage.\n- Model quality differences on this tiny set do not establish statistical superiority. Do not choose a production model from these scores alone.\n- Safari, real mobile hardware and other operating systems remain unverified.\n\n## Reproduce\n\nRun \`bun install --frozen-lockfile\`, \`bun test\`, \`bun run build\`, then \`bun run preview --port 4187 --strictPort\`. In another terminal run \`bun run benchmark\`, then \`bun run profile\`, then \`bun run report:generate\`. Do not run benchmark and profiler simultaneously. Rebuild to include updated measurements in the static report.\n`;
if (data.interruptions?.length)
  md +=
    "\n## Interrupted and resumed session\n\n" +
    data.interruptions.map((x: any) => x.reason).join("\n\n") +
    "\n\nThe resumed profiler source is archived at `provenance/profiler-session-1.ts.txt`; its SHA-256 matches the raw session metadata. Initial inference code is pinned by the commit above. Resuming restarts the browser and changes memory/cache baselines; the 32K BERT observations span two sessions.\n";
writeFileSync("results/README.md", md);

const csv = (rows: unknown[][]) =>
  rows
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n") + "\n";
const rows: unknown[][] = [
  [
    "model",
    "reference_length",
    "recorded_trials",
    "successful_trials",
    "failed_trials",
    "actual_input_tokens",
    "chunks",
    "median_complete_ms",
    "p95_complete_ms",
    "median_input_tokens_per_second",
    "median_chrome_cpu_percent_one_core",
    "median_baseline_chrome_rss_sum_mib",
    "peak_chrome_rss_sum_mib",
  ],
];
for (const model of data.models)
  for (const size of sizes) {
    const s = summary(model.key, size);
    rows.push([
      model.key,
      size,
      s.trials,
      s.successful,
      s.failures,
      s.tokens,
      s.chunks,
      s.medianMs,
      s.p95Ms,
      s.inputTokensPerSecond,
      s.cpuPercent,
      s.baselineRssMiB,
      s.peakRssMiB,
    ]);
  }
writeFileSync("results/resource-summary.csv", csv(rows));
writeFileSync(
  "results/quality-summary.csv",
  csv([
    ["configuration", "precision", "recall", "f1", "shared_ner_f1", "failures"],
    ...quality.summaries.map((s: any) => [
      s.config,
      s.full.precision,
      s.full.recall,
      s.full.f1,
      s.commonEntities.f1,
      s.failures,
    ]),
  ]),
);

const successfulWarm = data.runs.filter(
  (r: ProfileRun) => r.phase === "warm" && !r.error,
).length;
const failedAttempts = data.runs.filter((r: ProfileRun) => r.error).length;
md += `\n## Run accounting and downloads\n\n${successfulWarm} successful warmed requests; ${failedAttempts} recorded failed attempts across all phases; ${data.interruptions?.length ?? 0} separately documented interruption. Completed and failed trial counts are shown separately; failed timings do not become zero-duration successes. The profiler retains a nonzero exit status when its history contains failures, even after successful resumption.\n\nDownload [resource-summary.csv](resource-summary.csv), [quality-summary.csv](quality-summary.csv), [raw browser quality results](chromium-smoke.json), [raw resource samples](../public/measurements.json), or [browser test evidence](browser-checks.json).\n`;
writeFileSync("results/README.md", md);
