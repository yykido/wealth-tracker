import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name, exact: true });
const openImport = async (page) => {
  await page
    .getByRole("button", { name: "Import screenshot", exact: true })
    .first()
    .click();
  return page.getByRole("dialog", { name: "Import payments", exact: true });
};
async function paste(page, text) {
  const dialog = await openImport(page);
  await dialog.getByRole("button", { name: "Paste a payment list" }).click();
  await dialog.getByLabel("Payment list text").fill(text);
  await dialog.getByRole("button", { name: "Build review table" }).click();
  return dialog;
}
test("actual local OCR reads and bulk-imports a screenshot without external requests", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith("http://127.0.0.1:5173/"))
      external.push(url);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1400, 420);
    ctx.fillStyle = "black";
    ctx.font = "32px monospace";
    [
      "20.10.2026 REWE -42,80 EUR",
      "21.10.2026 DB ticket -29,90 EUR",
      "22.10.2026 Restaurant -35,00 EUR",
    ].forEach((line, i) => ctx.fillText(line, 50, 90 + i * 110));
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const dialog = await openImport(page);
  await dialog.getByLabel("Recognition language").selectOption("eng+deu");
  await dialog.getByLabel("Payment screenshot").setInputFiles({
    name: "fictional-payments.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await dialog
    .getByRole("button", { name: "Scan payment list", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Review 3 payments", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByLabel("Description 1", { exact: true })).toHaveValue(
    "REWE",
  );
  await expect(dialog.getByLabel("Amount 1", { exact: true })).toHaveValue(
    "42,80",
  );
  await expect(
    dialog.getByRole("button", { name: "Import 3 selected payments" }),
  ).toBeEnabled();
  await page.screenshot({
    path: join(tmpdir(), "wealth-tracker-import-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: join(tmpdir(), "wealth-tracker-import-mobile.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Import 3 selected payments" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#recorded-payments")).toContainText("REWE");
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("107,70");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  await nav(page, "Expenses").click();
  await expect(page.locator("#recorded-payments")).toContainText(
    "3 records this month",
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  const repeated = await paste(page, "20.10.2026 REWE -42,80 EUR");
  await expect(
    repeated.getByLabel("Select payment 1", { exact: true }),
  ).not.toBeChecked();
  await expect(
    repeated.getByText("Possible duplicate", { exact: true }),
  ).toBeVisible();
  await repeated.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(external).toEqual([]);
});
test("manual totals require a conflict choice; payments survive backup recovery", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  await page.getByRole("button", { name: "Add monthly cost" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("New category name").fill("Groceries");
  await dialog.getByLabel("Monthly total (€)").fill("400,00");
  await dialog.getByLabel("Month", { exact: true }).fill("2026-10");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  dialog = await paste(
    page,
    "20.10.2026 REWE -42,80 EUR\n20.10.2026 Salary +2.000,00 EUR",
  );
  await expect(
    dialog.getByLabel("Select payment 2", { exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("button", {
      name: "Import 1 selected payment",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByLabel(/Keep manual total/).check();
  await dialog
    .getByRole("button", { name: "Import 1 selected payment", exact: true })
    .click();
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("400,00");
  await expect(page.locator("#recorded-payments")).toContainText(
    "Manual total takes priority",
  );
  dialog = await paste(page, "21.10.2026 REWE -20,00 EUR");
  await dialog.getByLabel(/Replace the manual total/).check();
  await dialog
    .getByRole("button", { name: "Import 1 selected payment", exact: true })
    .click();
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("62,80");
  await page.getByRole("button", { name: "Edit payment REWE" }).first().click();
  dialog = page.getByRole("dialog", { name: "Edit payment" });
  await dialog.getByLabel("Amount (€)").fill("25,00");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("67,80");
  await nav(page, "Data & backup").click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const path = await (await download).path();
  await page.getByRole("button", { name: "Clear all records" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Erase all records" })
    .click();
  await page.getByLabel("Select JSON backup").setInputFiles(path);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace & restore" })
    .click();
  await nav(page, "Expenses").click();
  await expect(page.locator("#recorded-payments")).toContainText(
    "2 records this month",
  );
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("67,80");
});

test("a canceled scan can be retried without saving any payments", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 150;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 400, 150);
    ctx.fillStyle = "black";
    ctx.font = "20px monospace";
    ctx.fillText("20.10.2026 REWE -42,80 EUR", 10, 60);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.route("**/ocr/worker.min.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue().catch(() => {});
  });
  const dialog = await openImport(page);
  await dialog.getByLabel("Payment screenshot").setInputFiles({
    name: "cancel-fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await dialog
    .getByRole("button", { name: "Scan payment list", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Cancel scan", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Scan payment list", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Paste a payment list" }).click();
  await dialog
    .getByLabel("Payment list text")
    .fill("20.10.2026 REWE -42,80 EUR");
  await dialog.getByRole("button", { name: "Build review table" }).click();
  await expect(
    dialog.getByRole("button", {
      name: "Import 1 selected payment",
      exact: true,
    }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#recorded-payments")).toContainText(
    "0 records this month",
  );
});

test("description can stay blank through bulk import, editing, and backup recovery", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await nav(page, "Expenses").click();
  let dialog = await paste(page, "20.10.2026 REWE -42,80 EUR");
  await dialog.getByLabel("Description 1", { exact: true }).fill("");
  await expect(
    dialog.getByRole("button", {
      name: "Import 1 selected payment",
      exact: true,
    }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Import 1 selected payment", exact: true })
    .click();
  await expect(page.locator("#recorded-payments")).toContainText(
    "No description",
  );
  await page
    .locator("#recorded-payments")
    .getByRole("button", { name: /Edit payment/ })
    .click();
  dialog = page.getByRole("dialog", { name: "Edit payment" });
  await expect(
    dialog.getByLabel("Description (optional)", { exact: true }),
  ).toHaveValue("");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "Data & backup").click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const file = await (await downloaded).path();
  await page.getByRole("button", { name: "Clear all records" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Erase all records" })
    .click();
  await page.getByLabel("Select JSON backup").setInputFiles(file);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace & restore" })
    .click();
  await nav(page, "Expenses").click();
  await expect(page.locator("#recorded-payments")).toContainText(
    "No description",
  );
  await expect(
    page.locator(".summary-band .metric-number").first(),
  ).toContainText("42,80");
});
