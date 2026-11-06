import "./prepare.mjs";
import { cpSync, mkdirSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const path of ["index.html", "report.html", "src", "public"])
  cpSync(path, `dist/${path}`, { recursive: true });
console.log("Static files copied to dist/ (no compilation or bundling).");
