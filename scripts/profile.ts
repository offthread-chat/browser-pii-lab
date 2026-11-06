import { deadline } from "./deadline";
import { chromium, type CDPSession } from "playwright";
import { execFileSync } from "node:child_process";
import { cpus, totalmem, platform, release, arch } from "node:os";
import { readFileSync, writeFileSync } from "node:fs";
import { MODELS, CONFIG } from "../src/models";
import { createHash } from "node:crypto";
const manifest = JSON.parse(readFileSync("data/length-manifest.json", "utf8"));
type Sample = {
  elapsedMs: number;
  rssMiB: number | null;
  processes: { id: number; type: string; cpuTime: number }[];
  error?: string;
};
async function snapshot(cdp: CDPSession, started: number): Promise<Sample> {
  let processInfo: any[];
  try {
    ({ processInfo } = await deadline(
      cdp.send("SystemInfo.getProcessInfo"),
      5000,
    ));
  } catch (e) {
    return {
      elapsedMs: performance.now() - started,
      rssMiB: null,
      processes: [],
      error: String(e),
    };
  }
  const processes = processInfo.map((p: any) => ({
    id: p.id,
    type: p.type,
    cpuTime: p.cpuTime,
  }));
  try {
    const ids = processes
      .map((p: any) => Number(p.id))
      .filter((n: number) => Number.isSafeInteger(n) && n > 0);
    const values = execFileSync("ps", ["-o", "rss=", "-p", ids.join(",")], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/)
      .map(Number);
    return {
      elapsedMs: performance.now() - started,
      rssMiB: values.reduce((a, b) => a + b, 0) / 1024,
      processes,
    };
  } catch (e) {
    return {
      elapsedMs: performance.now() - started,
      rssMiB: null,
      processes,
      error: String(e),
    };
  }
}
async function measured<T>(cdp: CDPSession, fn: () => Promise<T>) {
  const start = performance.now(),
    samples: Sample[] = [await snapshot(cdp, start)];
  let stop = false;
  let failWatch: (e: Error) => void = () => {};
  const watchdog = new Promise<never>((_, reject) => {
    failWatch = reject;
  });
  let wake: (() => void) | undefined;
  const loop = (async () => {
    while (!stop) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 250);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      if (!stop) {
        const sample = await snapshot(cdp, start);
        samples.push(sample);
        if (
          sample.error ||
          !sample.processes.some((p) => p.type === "renderer")
        )
          failWatch(
            new Error(
              sample.error ?? "Chrome renderer exited during measurement",
            ),
          );
      }
    }
  })();
  let value: T | undefined,
    error: string | null = null;
  try {
    value = await deadline(Promise.race([fn(), watchdog]), 1_200_000);
  } catch (e) {
    error = String(e);
  }
  const wallMs = performance.now() - start;
  stop = true;
  wake?.();
  await loop;
  samples.push(await snapshot(cdp, start));
  const first = samples[0],
    last = samples.at(-1)!;
  let cpuSeconds = 0;
  const seen = new Set<number>();
  for (let i = 1; i < samples.length; i++) {
    const prev = new Map(
      samples[i - 1].processes.map((p) => [p.id, p.cpuTime]),
    );
    for (const p of samples[i].processes) {
      cpuSeconds += Math.max(
        0,
        p.cpuTime - (prev.get(p.id) ?? (seen.has(p.id) ? p.cpuTime : 0)),
      );
      seen.add(p.id);
    }
  }
  const sampleWindowMs = last.elapsedMs - first.elapsedMs;
  const rss = samples.flatMap((s) => (s.rssMiB === null ? [] : [s.rssMiB]));
  return {
    value,
    error,
    wallMs,
    cpuSeconds,
    cpuPercentOneCore:
      sampleWindowMs > 0 ? (cpuSeconds / (sampleWindowMs / 1000)) * 100 : null,
    baselineRssMiB: first.rssMiB,
    peakRssMiB: rss.length ? Math.max(...rss) : null,
    endingRssMiB: last.rssMiB,
    sampleWindowMs,
    samples,
  };
}
let report: any = {
  schemaVersion: 1,
  createdUTC: new Date().toISOString(),
  createdLocal: new Date().toString(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  lockHash: createHash("sha256").update(readFileSync("bun.lock")).digest("hex"),
  config: CONFIG,
  models: MODELS,
  corpus: manifest,
  host: {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCores: cpus().length,
    physicalMemoryGiB: totalmem() / 1024 ** 3,
  },
  methodology: {
    cpu: "Chrome-reported cumulative CPU seconds sampled for all processes in a dedicated Chrome instance; 100% = one logical core. Polling overhead included; exited-between-samples processes can be missed.",
    memory:
      "OS ps RSS summed across Chrome process IDs, in MiB. Includes browser/runtime/shared-page double counting; not model-exclusive memory or JS heap. Sampling can miss brief peaks.",
    samplingIntervalMs: 250,
    firstResult:
      "Complete detection result, including download/initialization for firstLoad. Not generation TTFT.",
    tokens:
      "Actual tokenizer input lengths per chunk, including repeated special tokens. Preflight token counting is included in inference latency. No output-token generation.",
    trials:
      "30 short, 5 4K, 3 32K, 1 100K; five short warmups before measured inference. Single long run has no p95.",
    cache:
      "New temporary browser context per model; firstLoad has empty context caches but OS/CDN/network caches are not controlled.",
    workload:
      "One repetitive synthetic English template; same files across models. Not a representative document or accuracy benchmark.",
  },
  runs: [],
};
const resume = process.argv.includes("--resume");
if (resume) {
  const previous = JSON.parse(readFileSync("public/measurements.json", "utf8"));
  if (
    previous.lockHash !== report.lockHash ||
    JSON.stringify(previous.config) !== JSON.stringify(report.config) ||
    JSON.stringify(previous.models) !== JSON.stringify(report.models) ||
    JSON.stringify(previous.corpus) !== JSON.stringify(report.corpus)
  )
    throw new Error("Cannot resume with changed dependencies or inputs");
  report = previous;
}
report.sessions ??= [{ id: "initial", inferenceCommit: report.commit }];
const sessionId = "session-" + report.sessions.length;
report.sessions.push({
  id: sessionId,
  createdUTC: new Date().toISOString(),
  createdLocal: new Date().toString(),
  inferenceCommit: report.commit,
  profilerHash: createHash("sha256")
    .update(readFileSync("scripts/profile.ts"))
    .digest("hex"),
  resumed: resume,
});
report.interruptions ??= [];
const countFor = (name: string) =>
  name === "short" ? 30 : name === "4k" ? 5 : name === "32k" ? 3 : 1;
const done = (model: string, length: string, trial: number) =>
  report.runs.some(
    (r: any) =>
      r.model === model &&
      r.phase === "warm" &&
      r.length === length &&
      r.trial === trial &&
      !r.error,
  );
for (const model of MODELS) {
  if (
    manifest.fixtures.every((f: any) =>
      Array.from({ length: countFor(f.name) }, (_, i) =>
        done(model.key, f.name, i),
      ).every(Boolean),
    )
  )
    continue;
  console.log(`Profiling ${model.key}`);
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  report.browser = await browser.version();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4187");
    const cdp = await browser.newBrowserCDPSession();
    const detect = async (text: string) =>
      page.evaluate(
        async ({ key, text }) => {
          const r = await (window as any).piiLab.profileDetect(key, text);
          const { spans, resources, ...timing } = r;
          return { ...timing, spanCount: spans.length };
        },
        { key: model.key, text },
      );
    const short = readFileSync(manifest.fixtures[0].path, "utf8");
    const firstLoad = await measured(cdp, () => detect(short));
    report.runs.push({
      model: model.key,
      phase: report.runs.some(
        (r: any) => r.model === model.key && r.phase === "firstLoad",
      )
        ? "restartLoad"
        : "firstLoad",
      sessionId,
      length: "short",
      trial: 0,
      ...firstLoad,
    });
    writeFileSync(
      "public/measurements.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    if (firstLoad.error) {
      console.log(firstLoad.error);
      continue;
    }
    for (let i = 0; i < 5; i++) await detect(short);
    for (const fixture of manifest.fixtures) {
      const text = readFileSync(fixture.path, "utf8");
      const repetitions =
        fixture.name === "short"
          ? 30
          : fixture.name === "4k"
            ? 5
            : fixture.name === "32k"
              ? 3
              : 1;
      for (let trial = 0; trial < repetitions; trial++) {
        if (done(model.key, fixture.name, trial)) continue;
        const run = await measured(cdp, () => detect(text));
        report.runs.push({
          model: model.key,
          phase: "warm",
          sessionId,
          length: fixture.name,
          trial,
          ...run,
        });
        writeFileSync(
          "public/measurements.json",
          JSON.stringify(report, null, 2) + "\n",
        );
        console.log(
          `${model.key} ${fixture.name} ${trial + 1}/${repetitions}: ${Math.round(run.wallMs)} ms; ${run.error ?? "ok"}`,
        );
        if (run.error) {
          console.log(
            "Failed run saved; stopping so --resume can retry in a fresh browser.",
          );
          throw new Error(run.error);
        }
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
report.completedUTC = new Date().toISOString();
report.completedLocal = new Date().toString();
writeFileSync(
  "public/measurements.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log("Saved public/measurements.json");
if (report.runs.some((r: any) => r.error)) process.exitCode = 1;
