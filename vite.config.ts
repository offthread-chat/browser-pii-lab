import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export default defineConfig({
  base: "./",
  worker: { format: "es" },
  define: {
    __COMMIT__: JSON.stringify(
      execSync("git rev-parse HEAD").toString().trim(),
    ),
    __LOCK_HASH__: JSON.stringify(
      createHash("sha256").update(readFileSync("bun.lock")).digest("hex"),
    ),
  },
});
