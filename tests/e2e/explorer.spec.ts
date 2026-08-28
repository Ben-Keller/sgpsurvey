import { expect, test } from "@playwright/test";

const isMobileProject = (name: string) => name === "mobile" || name === "narrow";

async function openMobileMenuAction(page: import("@playwright/test").Page, action: "Questions" | "Filters") {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: new RegExp(`^${action}`) }).click();
}

test("opens a direct question, changes chart, and preserves navigation state", async ({ page }) => {
  await page.goto("/country-teams/q14");
  await expect(page.locator("#question-14").getByRole("heading", { level: 2 })).toContainText("Q14");
  const activeQuestion = page.locator("#question-14");
  await expect(activeQuestion.getByLabel("Chart type")).toHaveValue("radar");
  await activeQuestion.getByLabel("Chart type").selectOption("heatmap");
  await expect(page).toHaveURL(/chart=heatmap/);
  await page.getByRole("link", { name: /Next/ }).last().click();
  await expect(page).toHaveURL(/country-teams\/q15/);
});

test("keeps the visualization frame stable across chart and table changes", async ({ page }) => {
  await page.goto("/country-teams/q3");
  const question = page.locator("#question-3");
  const frame = question.locator(".visual-frame");
  await expect(frame.getByRole("button", { name: "Download chart as PNG" })).toHaveAttribute("data-tooltip", "Download PNG image");
  await expect(frame.locator(".chart-shell")).toHaveAttribute("aria-busy", "false");
  let previousHeight = -1;
  let stableSamples = 0;
  await expect.poll(async () => {
    const height = await question.evaluate((element) => element.getBoundingClientRect().height);
    stableSamples = Math.abs(height - previousHeight) < 0.1 ? stableSamples + 1 : 0;
    previousHeight = height;
    return stableSamples;
  }, { intervals: [100], timeout: 3000 }).toBeGreaterThanOrEqual(2);
  const initialFrame = await frame.boundingBox();
  const initialQuestionHeight = await question.evaluate((element) => element.getBoundingClientRect().height);

  await question.getByLabel("Chart type").selectOption("donut");
  await expect(frame).toHaveAttribute("data-chart-view", "donut");
  await expect(frame.locator(".chart-shell")).toHaveAttribute("aria-busy", "false");
  expect(Math.abs((await frame.boundingBox())!.height - initialFrame!.height)).toBeLessThan(0.1);

  await question.getByLabel("Chart type").selectOption("data_table");
  await expect(frame).toHaveAttribute("data-chart-view", "data_table");
  await expect(frame.getByRole("region", { name: "Full data for question 3" })).toBeVisible();
  await expect(frame.getByRole("button", { name: "Download data as CSV" })).toHaveAttribute("data-tooltip", "Download CSV data");
  expect(Math.abs((await frame.boundingBox())!.height - initialFrame!.height)).toBeLessThan(0.1);
  const tableQuestionHeight = await question.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(tableQuestionHeight - initialQuestionHeight)).toBeLessThan(3);
});

test("starts visualization motion only when the ready frame enters the viewport", async ({ page }) => {
  await page.goto("/country-teams/q14");
  const frame = page.locator("#question-14 .visual-frame");
  await expect(frame).toHaveClass(/is-in-view/);
  await expect(frame).toHaveCSS("animation-name", "visual-frame-in");
  const radarShell = frame.locator(".chart-shell");
  await expect(radarShell).toHaveAttribute("data-intro", "playing");
  await expect(radarShell.locator(".chart")).toHaveCSS("animation-name", "chart-canvas-in");
  await expect(radarShell).toHaveAttribute("data-intro", "complete", { timeout: 2000 });

  await page.goto("/country-teams/q3");
  const donutShell = page.locator("#question-3 .chart-shell");
  await expect(donutShell).toHaveAttribute("data-intro", "playing");
  await expect(donutShell.locator(".chart")).toHaveCSS("animation-name", "chart-canvas-scale-in");

  await page.goto("/country-teams/q3?chart=data_table");
  const tableFrame = page.locator("#question-3 .visual-frame");
  await expect(tableFrame).toHaveClass(/is-in-view/);
  await expect(tableFrame).toHaveCSS("animation-name", "visual-frame-in");
});

test("anchors bar and radar tooltips to their actual rendered marks", async ({ page }, testInfo) => {
  const mobile = isMobileProject(testInfo.project.name);
  await page.goto("/country-teams/q9");
  const barChart = page.locator("#question-9 .chart");
  await expect(page.locator("#question-9 .chart-shell")).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(850);
  if (mobile) {
    await barChart.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 240));
    await page.waitForTimeout(180);
  }
  const barBox = await barChart.boundingBox();
  expect(barBox).not.toBeNull();
  const barLeft = mobile ? 132 : 262;
  const barRight = mobile ? 46 : 65;
  const barTop = mobile ? 16 : 12;
  const barBottom = mobile ? 34 : 35;
  const firstRowY = barTop + (barBox!.height - barTop - barBottom) / 16;
  const barX = barLeft + (barBox!.width - barLeft - barRight) * .55;
  if (mobile) await page.touchscreen.tap(barBox!.x + barX, barBox!.y + firstRowY);
  else await page.mouse.move(barBox!.x + barX, barBox!.y + firstRowY);
  const barTooltip = page.locator(mobile ? "#question-9 .manual-chart-tooltip" : "#question-9 .survey-chart-tooltip");
  await expect(barTooltip).toBeVisible();
  await expect(barTooltip).toContainText("Proposal review/refinement");
  const barTipBox = await barTooltip.boundingBox();
  expect(barTipBox).not.toBeNull();
  expect(barTipBox!.x).toBeGreaterThanOrEqual(barBox!.x - 1);
  expect(barTipBox!.x + barTipBox!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width + 1);
  expect(barTipBox!.y).toBeGreaterThanOrEqual(barBox!.y - 1);
  expect(barTipBox!.y + barTipBox!.height).toBeLessThanOrEqual(barBox!.y + barBox!.height + 1);

  await page.goto("/country-teams/q14");
  const radarChart = page.locator("#question-14 .chart");
  await expect(page.locator("#question-14 .chart-shell")).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(850);
  if (mobile) {
    await radarChart.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 240));
    await page.waitForTimeout(180);
  }
  const radarBox = await radarChart.boundingBox();
  expect(radarBox).not.toBeNull();
  const radarRadius = Math.min(radarBox!.width, radarBox!.height) * (mobile ? .43 : .62) / 2;
  const radarCenterY = radarBox!.height * (mobile ? .48 : .5);
  const radarX = radarBox!.x + radarBox!.width / 2;
  const radarY = radarBox!.y + radarCenterY - radarRadius * .742;
  if (mobile) await page.touchscreen.tap(radarX, radarY);
  else await page.mouse.move(radarX, radarY);
  const radarTooltip = page.locator("#question-14 .radar-hover-tooltip");
  await expect(radarTooltip).toBeVisible();
  await expect(radarTooltip).toContainText("SGP database");
  await expect(radarTooltip).toContainText("74.2%");
  const radarTipBox = await radarTooltip.boundingBox();
  expect(radarTipBox).not.toBeNull();
  expect(radarTipBox!.x).toBeGreaterThanOrEqual(radarBox!.x - 1);
  expect(radarTipBox!.x + radarTipBox!.width).toBeLessThanOrEqual(radarBox!.x + radarBox!.width + 1);

  const wrappedLabelIndex = 11;
  const wrappedLabelAngle = (90 + wrappedLabelIndex * 360 / 14) * Math.PI / 180;
  const wrappedLabelX = radarBox!.x + radarBox!.width / 2 + (radarRadius + 15) * Math.cos(wrappedLabelAngle) + 30;
  const wrappedLabelY = radarBox!.y + radarCenterY - (radarRadius + 15) * Math.sin(wrappedLabelAngle) + (mobile ? 5 : 7);
  if (mobile) await page.touchscreen.tap(wrappedLabelX, wrappedLabelY);
  else await page.mouse.move(wrappedLabelX, wrappedLabelY);
  await expect(radarTooltip).toBeVisible();
  await expect(radarTooltip).toContainText("Workshops, exchanges, or peer networks");
});

test("keeps stakeholder tabs inside the sticky header without an About link", async ({ page }, testInfo) => {
  await page.goto("/country-teams/q14");
  const header = page.locator("header.site-header");
  await expect(header.getByRole("navigation", { name: "Stakeholder groups" })).toBeVisible();
  if (isMobileProject(testInfo.project.name)) await expect(header.getByRole("button", { name: "Open menu" })).toBeVisible();
  else await expect(header.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(header.locator(".brand, .brand-mark")).toHaveCount(0);
  await expect(header).not.toContainText("Survey Explorer");
  await expect(header).toHaveCSS("position", "sticky");
  if (!isMobileProject(testInfo.project.name)) await expect(header.getByRole("button", { name: "Download PDF" })).toHaveAttribute("data-tooltip", "Download PDF report");
  await expect(page.getByRole("link", { name: "About the survey" })).toHaveCount(0);
  await expect(page.locator(".context-bar")).toHaveCount(0);
  await expect(page.locator(".metadata")).toHaveCount(0);
});

test("aligns the main stakeholder title to the page rather than the question rail", async ({ page }, testInfo) => {
  await page.goto("/country-teams/q14");
  const titleLeft = await page.locator(".survey-masthead h1").evaluate((element) => element.getBoundingClientRect().left);
  const railRight = await page.locator(".navigator-shell").evaluate((element) => element.getBoundingClientRect().right);

  expect(titleLeft).toBeLessThan(90);
  if (!isMobileProject(testInfo.project.name)) expect(titleLeft).toBeLessThan(railRight);
});

test("fades the bottom navigation rail with the active section accent", async ({ page }) => {
  await page.goto("/country-teams/q2");
  const rail = page.getByRole("navigation", { name: "Sequential question navigation" });
  await expect(rail).toHaveCSS("background-color", "rgb(63, 126, 68)");
  await expect(rail).toHaveCSS("transition-duration", /0\.52s/);

  await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
  await page.locator("#question-9").scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/country-teams\/q9/);
  await expect(rail).toHaveCSS("background-color", "rgb(38, 189, 226)");
});

test("uses a distinct accessible accent for each stakeholder type", async ({ page }) => {
  const routes = ["country-teams/q2", "grantee-partners/q30", "implementing-agencies/q64", "steering-committees/q72"];
  const accents: string[] = [];
  for (const route of routes) {
    await page.goto(`/${route}`);
    accents.push(await page.locator(".app-shell").evaluate((element) => getComputedStyle(element).getPropertyValue("--forest").trim()));
  }
  expect(new Set(accents).size).toBe(4);
});

test("shows each subsection title once instead of repeating it on every question", async ({ page }) => {
  await page.goto("/country-teams/q17");
  await expect(page.locator(".question-subsection:has(#question-17) > .subsection-marker h2")).toHaveText("Implementation support and knowledge sources");
  await expect(page.locator(".question-subsection:has(#question-17) > .subsection-marker")).toHaveCount(1);
  await expect(page.locator(".question-header > .eyebrow")).toHaveCount(0);
});

test("virtualizes the question stream and follows the reading position", async ({ page }) => {
  await page.goto("/country-teams/q14");
  await expect(page.locator("#question-14")).toHaveAttribute("data-mounted", "true");
  await expect(page.locator("#question-14").getByRole("heading", { level: 2 })).toContainText("Q14");

  const initiallyMounted = await page.locator("[data-mounted=true]").count();
  expect(initiallyMounted).toBeLessThan(8);
  await expect(page.locator("#question-2")).toHaveAttribute("data-mounted", "false");

  await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
  await page.locator("#question-29").scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/country-teams\/q29/);
  await expect(page.locator(".question-nav-indicator")).toHaveAttribute("data-question-number", "29");
  await expect(page.locator("#question-14")).toHaveAttribute("data-mounted", "false");
  await expect(page.locator("#question-29 .question-reveal")).toHaveCSS("animation-name", "question-in");
});

test("removes stale reserved space as soon as a question mounts", async ({ page }) => {
  await page.goto("/country-teams/q14");
  const question = page.locator("#question-14");
  await expect(question).toHaveAttribute("data-mounted", "true");
  expect(await question.evaluate((element) => element.style.height)).toBe("auto");
  const gap = await question.evaluate((element) => {
    const content = element.querySelector<HTMLElement>(".virtual-question__content");
    if (!content) return Number.POSITIVE_INFINITY;
    return Math.abs(element.getBoundingClientRect().height - content.getBoundingClientRect().height);
  });
  expect(gap).toBeLessThan(2);

  const distant = page.locator("#question-2");
  await expect(distant).toHaveAttribute("data-mounted", "false");
  expect(await distant.evaluate((element) => element.style.height)).toMatch(/^\d+px$/);
});

test("keeps an existing chart canvas stable while the next question becomes active", async ({ page }) => {
  await page.goto("/country-teams/q14");
  const originalCanvas = page.locator("#question-14 canvas").first();
  await expect(originalCanvas).toBeVisible();
  await originalCanvas.evaluate((canvas) => canvas.setAttribute("data-lifecycle-marker", "stable"));

  await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
  await page.locator("#question-15").scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/country-teams\/q15/);
  await expect(page.locator("#question-14")).toHaveAttribute("data-mounted", "true");
  await expect(page.locator('#question-14 canvas[data-lifecycle-marker="stable"]')).toHaveCount(1);
});

test("keeps distant menu navigation locked while the viewport indicator glides", async ({ page }, testInfo) => {
  await page.goto("/country-teams/q2");
  if (isMobileProject(testInfo.project.name)) await openMobileMenuAction(page, "Questions");
  await page.evaluate(() => {
    const sampledPaths: string[] = [];
    (window as any).__sampledPaths = sampledPaths;
    (window as any).__pathSampler = window.setInterval(() => sampledPaths.push(window.location.pathname), 20);
  });

  const destination = page.getByRole("navigation", { name: "Country Teams questions" }).getByRole("link", { name: /Q29/ });
  const persistentDestination = page.locator('.question-nav a[href*="/country-teams/q29"]');
  await destination.click();
  await expect(page).toHaveURL(/country-teams\/q29/);
  await expect(page.locator("#question-29")).toBeInViewport();
  await page.waitForTimeout(250);

  const sampledPaths = await page.evaluate(() => {
    window.clearInterval((window as any).__pathSampler);
    return [...new Set((window as any).__sampledPaths as string[])];
  });
  expect(sampledPaths.filter((path) => path !== "/country-teams/q2")).toEqual(["/country-teams/q29"]);
  await expect(persistentDestination).not.toHaveClass(/active/);
});

test("releases automatic scrolling before a later manual scrollbar move", async ({ page }, testInfo) => {
  await page.goto("/country-teams/q2");
  if (isMobileProject(testInfo.project.name)) await openMobileMenuAction(page, "Questions");
  await page.getByRole("navigation", { name: "Country Teams questions" }).getByRole("link", { name: /Q14/ }).click();
  await expect(page).toHaveURL(/country-teams\/q14/);
  await page.waitForTimeout(2100);

  const manualPosition = await page.evaluate(() => {
    window.scrollBy({ top: 720, behavior: "auto" });
    return window.scrollY;
  });
  await page.waitForTimeout(700);
  const settledPosition = await page.evaluate(() => window.scrollY);
  expect(Math.abs(settledPosition - manualPosition)).toBeLessThan(80);
});

test("public small-cell filters suppress all results", async ({ page }, testInfo) => {
  await page.goto("/implementing-agencies/q64");
  if (isMobileProject(testInfo.project.name)) await openMobileMenuAction(page, "Filters");
  else await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByRole("checkbox", { name: /Arabic 1/ }).click();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page.locator("#question-64").getByRole("heading", { name: "Insufficient responses for this filtered view" })).toBeVisible();
});

test("publishes approved qualitative responses with local search", async ({ page }) => {
  await page.goto("/grantee-partners/q45");
  const question = page.locator("#question-45");
  await expect(question.getByRole("region", { name: "Qualitative responses" })).toBeVisible();
  await expect(question).not.toContainText("pending review");
  await expect(question.getByRole("searchbox", { name: "Search responses" })).toHaveAttribute("placeholder", "Search responses");
  await expect(question.getByRole("button", { name: "Download responses as CSV" })).toHaveAttribute("data-tooltip", "Download CSV responses");
  await expect(question.getByText("Sort", { exact: true })).toHaveCount(0);
  await expect(question.locator(".response-meta")).toHaveCount(0);
  const displayMode = question.getByRole("switch", { name: "Response display mode" });
  await expect(displayMode).toBeChecked();
  const fullPadding = await question.locator(".response-card").first().evaluate((element) => getComputedStyle(element).padding);
  await displayMode.focus();
  await displayMode.press("Space");
  await expect(displayMode).not.toBeChecked();
  const firstCard = question.locator(".response-card").first();
  await expect.poll(() => firstCard.evaluate((element) => getComputedStyle(element).padding)).toBe(fullPadding);
  await expect(firstCard.getByRole("button", { name: "Expand" })).toBeVisible();
  await expect(firstCard.locator("p")).toHaveCSS("-webkit-line-clamp", "2");
  await firstCard.getByRole("button", { name: "Expand" }).click();
  await expect(firstCard).toHaveClass(/expanded/);
  await expect(firstCard.getByRole("button", { name: "Collapse" })).toBeVisible();
  await expect(question.locator(".response-card").first()).toBeVisible();

  const firstResponse = (await question.locator(".response-card p").first().innerText()).trim();
  const searchTerm = firstResponse.split(/\s+/).find((word) => word.length >= 5) ?? firstResponse;
  await question.getByRole("searchbox", { name: "Search responses" }).fill(searchTerm);
  await expect(question.locator(".response-card").first()).toContainText(new RegExp(searchTerm, "i"));
});

test("shows all implementing-agency responses for Q68", async ({ page }) => {
  await page.goto("/implementing-agencies/q68");
  const question = page.locator("#question-68");
  await expect(question.locator(".reader-count")).toContainText("18 responses · 0 blank answers");
  await expect(question.locator(".response-card").first()).toBeVisible();
  await expect(question).not.toContainText("No qualitative responses");
});

test("mobile question drawer remains usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/grantee-partners/q30");
  await openMobileMenuAction(page, "Questions");
  await expect(page.getByRole("navigation", { name: "Grantee Partners questions" })).toBeVisible();
});

test("@narrow keeps the complete mobile navigation flow inside 320px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "narrow");
  await page.goto("/country-teams/q14");
  await expect(page.locator("#question-14 .chart-shell")).toHaveAttribute("aria-busy", "false");

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    headerHeight: document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0,
    frameRight: document.querySelector("#question-14 .visual-frame")?.getBoundingClientRect().right ?? 0
  }));
  expect(layout.viewport).toBe(320);
  expect(layout.documentWidth).toBeLessThanOrEqual(320);
  expect(layout.headerHeight).toBe(116);
  expect(layout.frameRight).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Questions/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Filters/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Copy link/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Download PDF/ })).toBeVisible();
  await expect(menu).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(320);

  await menu.getByRole("button", { name: /^Questions/ }).click();
  await expect(page.getByRole("navigation", { name: "Country Teams questions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close questions" })).toBeVisible();
  await page.getByRole("button", { name: "Close questions" }).click();

  await openMobileMenuAction(page, "Filters");
  const filters = page.getByRole("dialog", { name: "Filters" });
  await expect(filters).toBeVisible();
  const filterBox = (await filters.boundingBox())!;
  expect(filterBox.x).toBeGreaterThanOrEqual(0);
  expect(filterBox.x + filterBox.width).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Close filters" }).click();
});
