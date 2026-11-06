// Copy published browser runtime assets. Application JavaScript is never bundled.
import "./copy-ort.mjs";
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
mkdirSync("public/vendor", { recursive: true });
copyFileSync(
  "node_modules/@huggingface/transformers/dist/transformers.min.js",
  "public/vendor/transformers.min.js",
);
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {}
const lockHash = createHash("sha256")
  .update(readFileSync("bun.lock"))
  .digest("hex");
writeFileSync(
  "src/build-info.js",
  `// Generated provenance, not application code.\nexport const commit = ${JSON.stringify(commit)};\nexport const lockHash = ${JSON.stringify(lockHash)};\n`,
);
