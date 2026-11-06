import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const full = process.argv.includes("--benchmark");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 960 },
});
const page = await context.newPage();
const errors: string[] = [];
const requests: { url: string; body: string | null }[] = [];
page.on("pageerror", (e) => errors.push(e.message));
context.on("request", (r) =>
  requests.push({ url: r.url(), body: r.postData() }),
);
await mkdir("test-artifacts", { recursive: true });
try {
  await page.goto("http://127.0.0.1:4187");
  assert.equal(
    requests.some((r) => r.url.includes("huggingface.co")),
    false,
    "Model must not download on page load",
  );
  const marker = "PRIVATE_SMOKE_9d7f@example.com";
  await page
    .locator("#input")
    .fill(`🧪 ${marker} <img src=x onerror=alert(1)>`);
  await page.locator("#detect").click();
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent?.startsWith("Complete:"),
  );
  assert.match(await page.locator("#redacted").innerText(), /\[REDACTED\]/);
  assert.equal(
    await page.locator("#highlight img").count(),
    0,
    "Input must never render as HTML",
  );
  await page.locator("#mode").selectOption("model");
  await page.locator("#model").selectOption("gravitee");
  await page.locator("#detect").click();
  await page.waitForFunction(
    () => {
      const s = document.querySelector("#status")?.textContent;
      return (
        s?.startsWith("Complete:") ||
        s?.includes("failed") ||
        s?.includes("Error")
      );
    },
    {},
    { timeout: 180000 },
  );
  assert.match(
    await page.locator("#status").innerText(),
    /^Complete:/,
    "Actual model must run",
  );
  await page.locator("#clear").click();
  assert.equal(await page.locator("#input").inputValue(), "");
  await page.locator("#input").fill("x".repeat(20001));
  await page.locator("#detect").click();
  assert.match(await page.locator("#status").innerText(), /exceeds/);
  await page.locator("#input").fill("My name is Sarah.");
  await page.locator("#detect").click();
  await page.locator("#cancel").click();
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>("#detect")!.disabled,
  );
  assert.match(await page.locator("#status").innerText(), /Cancelled/);
  assert.equal(
    requests.some((r) => r.url.includes(marker) || r.body?.includes(marker)),
    false,
    "Prompt text must not appear in network requests",
  );
  await page.locator("#mode").selectOption("hybrid");
  await page.locator("#example").click();
  await page.locator("#detect").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status")?.textContent?.startsWith("Complete:"),
    {},
    { timeout: 180000 },
  );
  await page.locator("#bench-one").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#status")
        ?.textContent?.startsWith("Benchmark complete"),
    {},
    { timeout: 180000 },
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadPromise;
  await download.saveAs("test-artifacts/ui-export.json");
  const exported = await readFile("test-artifacts/ui-export.json", "utf8");
  assert.equal(exported.includes(marker), false);
  assert.equal(JSON.parse(exported).summaries.length, 3);
  assert.equal(await page.locator("#summary tbody tr").count(), 3);
  await page.screenshot({ path: "test-artifacts/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-artifacts/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "No page-level horizontal overflow",
  );
  let benchmarkResult: any;
  if (full) {
    await page.setViewportSize({ width: 1280, height: 960 });
    benchmarkResult = await page.evaluate(
      async () =>
        await (window as any).piiLab.benchmark([
          "gravitee",
          "bert",
          "distilbert",
        ]),
    );
    await mkdir("results", { recursive: true });
    await writeFile(
      "results/chromium-smoke.json",
      JSON.stringify(benchmarkResult, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        benchmarkResult.summaries.map((s: any) => ({
          config: s.config,
          failures: s.failures,
          fullF1: s.full.f1,
          commonF1: s.commonEntities.f1,
        })),
        null,
        2,
      ),
    );
    assert.equal(
      benchmarkResult.summaries.reduce(
        (n: number, s: any) => n + s.failures,
        0,
      ),
      0,
      "All model runs should complete",
    );
  }
  assert.deepEqual(errors, [], "No uncaught browser errors");
  const failureContext = await browser.newContext();
  await failureContext.route("https://huggingface.co/**", (route) =>
    route.abort(),
  );
  const failurePage = await failureContext.newPage();
  await failurePage.goto("http://127.0.0.1:4187");
  await failurePage.locator("#mode").selectOption("model");
  await failurePage.locator("#detect").click();
  await failurePage.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>("#detect")!.disabled,
    {},
    { timeout: 180000 },
  );
  assert.doesNotMatch(
    await failurePage.locator("#status").innerText(),
    /^Complete:/,
  );
  assert.equal(
    await failurePage.locator("#redacted").innerText(),
    "No result yet.",
  );
  await failureContext.close();
  await writeFile(
    "test-artifacts/browser-checks.json",
    JSON.stringify(
      {
        createdUTC: new Date().toISOString(),
        createdLocal: new Date().toString(),
        browser: await browser.version(),
        checks: [
          "no eager model download",
          "regex redaction",
          "HTML escaping",
          "real WASM model",
          "clear",
          "length limit",
          "cancel",
          "hybrid",
          "no prompt network leak",
          "mobile overflow",
          "no uncaught errors",
          "benchmark UI and JSON export",
          "blocked model download surfaces failure",
        ],
        requestOrigins: [
          ...new Set(requests.map((r) => new URL(r.url).origin)),
        ],
      },
      null,
      2,
    ),
  );
  console.log("Browser checks passed.");
} finally {
  await context.close();
  await browser.close();
}
