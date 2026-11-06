export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function p95(values) {
  if (values.length < 20) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.ceil(0.95 * s.length) - 1];
}
export function summarize(runs) {
  const valid = runs.filter((r) => !r.error && r.value);
  const nums = (fn) =>
    valid.flatMap((r) => {
      const x = fn(r);
      return x === null || x === undefined ? [] : [x];
    });
  return {
    trials: runs.length,
    successful: valid.length,
    failures: runs.length - valid.length,
    medianMs: median(nums((r) => r.value.endToEndMs)),
    p95Ms: p95(nums((r) => r.value.endToEndMs)),
    tokens: median(nums((r) => r.value.inputTokens)),
    chunks: median(nums((r) => r.value.chunks)),
    inputTokensPerSecond: median(
      nums((r) => r.value.inputTokens / (r.value.endToEndMs / 1000)),
    ),
    firstChunkMs: median(nums((r) => r.value.firstChunkMs)),
    cpuPercent: median(nums((r) => r.cpuPercentOneCore)),
    baselineRssMiB: median(nums((r) => r.baselineRssMiB)),
    peakRssMiB: nums((r) => r.peakRssMiB).length
      ? Math.max(...nums((r) => r.peakRssMiB))
      : null,
  };
}
