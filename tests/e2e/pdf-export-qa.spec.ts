import path from "node:path";
import { test } from "@playwright/test";

test("generates the complete survey PDF for visual QA", async ({ page }) => {
  test.skip(process.env.PDF_EXPORT_QA !== "1");
  test.setTimeout(10 * 60 * 1000);
  await page.goto("/country-teams/q2");
  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadStarted;
  await download.saveAs(path.resolve("output/pdf/sgp-survey-complete-results.pdf"));
});
