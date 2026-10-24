import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name, exact: true });
const euro = (amount) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
test("manual records persist, then export and restore safely", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  await page.getByRole("button", { name: "Add monthly cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("New category name").fill("Groceries");
  await dialog.getByLabel("Monthly total (€)").fill("400,50");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("cell", { name: "Groceries", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Groceries cost" }).click();
  await page.getByRole("dialog").getByLabel("Monthly total (€)").fill("420,50");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(
    page.getByRole("cell", { name: euro(420.5), exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  await expect(
    page.getByRole("cell", { name: euro(420.5), exact: true }),
  ).toBeVisible();
  await nav(page, "Assets").click();
  await page
    .getByRole("button", { name: "Add account", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account name").fill("Test brokerage");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Update balance", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cash / savings (€)").fill("500,00");
  await dialog.getByLabel("Investments (€)").fill("3.000,00");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("cell", { name: euro(3500), exact: true }),
  ).toBeVisible();
  await nav(page, "Data & backup").click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backupFile = await (await downloaded).path();
  // Invalid imports must leave current records intact.
  await page.getByLabel("Select JSON backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await page.getByRole("button", { name: "Clear all records" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Erase all records" })
    .click();
  await page.getByLabel("Select JSON backup").setInputFiles(backupFile);
  dialog = page.getByRole("dialog", { name: "Review your backup" });
  await expect(dialog).toContainText("passed format and record validation");
  await dialog.getByRole("button", { name: "Replace & restore" }).click();
  await nav(page, "Assets").click();
  await expect(
    page.getByRole("heading", { name: "Test brokerage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: euro(3500), exact: true }),
  ).toBeVisible();
  await nav(page, "Expenses").click();
  await expect(
    page.getByRole("cell", { name: euro(420.5), exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("demo dashboard, projection scenarios, and mobile layout", async ({
  page,
}) => {
  const unexpected = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:5173") &&
      !request.url().startsWith("ws://127.0.0.1:5173")
    )
      unexpected.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore fictional example data" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Load example data" })
    .click();
  await expect(page.getByText("Example data", { exact: true })).toBeVisible();
  await expect(page.locator(".recharts-area-curve")).toHaveAttribute("d", /^M/);
  await expect(page.getByRole("status")).toBeHidden({ timeout: 7000 });
  await page.screenshot({
    path: join(tmpdir(), "wealth-tracker-desktop.png"),
    fullPage: true,
  });
  await nav(page, "Projections").click();
  await page.getByLabel("Starting amount in euros").fill("1000");
  await page.getByLabel("Monthly contribution (€)").fill("200");
  await page.getByLabel("Annual return (%)").fill("0");
  await page.getByLabel("Investment horizon").fill("10");
  await expect(page.locator(".projection-value")).toContainText("25.000");
  await page.getByRole("button", { name: "Save scenario" }).click();
  await expect(page.getByLabel("Saved scenario")).not.toHaveValue("");
  await page.screenshot({
    path: join(tmpdir(), "wealth-tracker-projection.png"),
    fullPage: true,
  });
  await nav(page, "Overview").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expect(page.getByRole("status")).toBeHidden({ timeout: 7000 });
  await page.screenshot({
    path: join(tmpdir(), "wealth-tracker-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Backup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your data. Your control." }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
