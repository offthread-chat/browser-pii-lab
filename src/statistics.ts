export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function p95(values: number[]) {
  if (values.length < 20) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.ceil(0.95 * s.length) - 1];
}
export type ProfileRun = {
  model: string;
  phase: string;
  length: string;
  trial: number;
  error: string | null;
  wallMs: number;
  cpuPercentOneCore: number | null;
  peakRssMiB: number | null;
  baselineRssMiB: number | null;
  value?: {
    endToEndMs: number;
    inputTokens: number;
    chunks: number;
    firstChunkMs: number | null;
    inferenceMs: number;
    loadMs: number;
    spanCount: number;
  };
  samples: { elapsedMs: number; rssMiB: number | null }[];
};
export function summarize(runs: ProfileRun[]) {
  const valid = runs.filter((r) => !r.error && r.value);
  const nums = (fn: (r: ProfileRun) => number | null | undefined) =>
    valid.flatMap((r) => {
      const x = fn(r);
      return x === null || x === undefined ? [] : [x];
    });
  return {
    trials: runs.length,
    successful: valid.length,
    failures: runs.length - valid.length,
    medianMs: median(nums((r) => r.value!.endToEndMs)),
    p95Ms: p95(nums((r) => r.value!.endToEndMs)),
    tokens: median(nums((r) => r.value!.inputTokens)),
    chunks: median(nums((r) => r.value!.chunks)),
    inputTokensPerSecond: median(
      nums((r) => r.value!.inputTokens / (r.value!.endToEndMs / 1000)),
    ),
    firstChunkMs: median(nums((r) => r.value!.firstChunkMs)),
    cpuPercent: median(nums((r) => r.cpuPercentOneCore)),
    peakRssMiB: nums((r) => r.peakRssMiB).length
      ? Math.max(...nums((r) => r.peakRssMiB))
      : null,
  };
}
