import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1360, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4187/report.html");
  await page.waitForFunction(
    () => document.querySelectorAll("#details tbody tr").length === 3,
  );
  assert.equal(await page.locator("#memory svg polyline").count(), 3);
  assert.equal(await page.locator("#cold tbody tr").count(), 3);
  assert.match(await page.locator("#metadata").innerText(), /logical cores/);
  await page.screenshot({
    path: "test-artifacts/report-desktop.png",
    fullPage: true,
  });
  for (const length of ["short", "4k", "32k", "100k"]) {
    await page.locator("#length").selectOption(length);
    for (const metric of [
      "medianMs",
      "inputTokensPerSecond",
      "cpuPercent",
      "peakRssMiB",
      "firstChunkMs",
    ]) {
      await page.locator("#metric").selectOption(metric);
      assert.equal(await page.locator("#bars>div").count(), 3);
      assert.doesNotMatch(
        await page.locator("#bars").innerText(),
        /NaN|undefined/,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-artifacts/report-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Report checks passed: 4 lengths × 5 metrics, three memory traces, desktop/mobile layout.",
  );
} finally {
  await browser.close();
}
