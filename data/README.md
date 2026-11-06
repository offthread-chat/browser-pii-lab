---
created: 2026-11-06
last_updated: 2026-11-06
---

# Public synthetic inputs

All text here is synthetic, project-authored and MIT licensed. `lengths/*.txt` contains the exact length-scaling inputs, not merely descriptions of them. `length-manifest.json` records SHA-256 checksums, lengths, repetition counts, the generating unit and the pinned reference tokenizer.

Regenerate with `bun run data:generate`. This command downloads only the reference tokenizer for counting; model inference is still performed in the browser by the benchmark/profiler. Whole-document reference counts include two special tokens. Actual inference counts include special tokens for every chunk and vary with each model's tokenizer.

| File | Reference tokens | Purpose |
|---|---:|---|
| `lengths/short.txt` | 36 | Repeated short-request latency |
| `lengths/4k.txt` | 4,099 | Thousands of tokens |
| `lengths/32k.txt` | 32,761 | Tens of thousands of tokens |
| `lengths/100k.txt` | 99,996 | Approximately 100K tokens |

These files repeat the same short English scenario. They measure scaling under a reproducible workload, not representative long-document quality. Entity names and contact information are fictional examples. Separately, `src/corpus.ts` holds the 6 development and 16 evaluation fixtures used for quality smoke tests, with explicit UTF-16 gold spans.
