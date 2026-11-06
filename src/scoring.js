import { intervals } from "./detection.js";
import { validateSpans } from "./types.js";
export function score(text, gold, predicted, failed = false) {
  validateSpans(text, gold);
  validateSpans(text, predicted);
  const remaining = new Set(gold.map((_, i) => i));
  let tp = 0;
  for (const p of predicted) {
    const i = gold.findIndex(
      (g, i) =>
        remaining.has(i) &&
        g.start === p.start &&
        g.end === p.end &&
        g.type === p.type,
    );
    if (i >= 0) {
      tp++;
      remaining.delete(i);
    }
  }
  const masked = intervals(predicted),
    truth = intervals(gold);
  const covered = gold.filter((g) =>
    masked.some((p) => p.start <= g.start && p.end >= g.end),
  ).length;
  let excess = 0,
    nonSensitive = 0;
  for (let i = 0; i < text.length; i++) {
    if (!truth.some((s) => s.start <= i && s.end > i)) {
      nonSensitive++;
      if (masked.some((s) => s.start <= i && s.end > i)) excess++;
    }
  }
  return {
    tp,
    fp: predicted.length - tp,
    fn: gold.length - tp,
    gold: gold.length,
    covered,
    excess,
    nonSensitive,
    clean: gold.length === 0 ? 1 : 0,
    changedClean: gold.length === 0 && predicted.length > 0 ? 1 : 0,
    allCovered: !failed && covered === gold.length ? 1 : 0,
    cases: 1,
  };
}
export function aggregate(rows) {
  const total = score("", [], []);
  for (const k of Object.keys(total))
    total[k] = rows.reduce((a, r) => a + r[k], 0);
  const ratio = (a, b) => (b ? a / b : null);
  return {
    ...total,
    precision: ratio(total.tp, total.tp + total.fp),
    recall: ratio(total.tp, total.tp + total.fn),
    f1: ratio(2 * total.tp, 2 * total.tp + total.fp + total.fn),
    coverage: ratio(total.covered, total.gold),
    overRedaction: ratio(total.excess, total.nonSensitive),
    cleanChanged: ratio(total.changedClean, total.clean),
    allCoveredRate: ratio(total.allCovered, total.cases),
  };
}
