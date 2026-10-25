import { test, expect } from "./fixtures.mjs";
const origin = "http://127.0.0.1:5173";
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name, exact: true });
test("an anonymous browser cannot read or write shared data, including with spoofed identity headers", async ({
  browser,
}) => {
  const isolated = await browser.newContext();
  try {
    const response = await isolated.request.get(`${origin}/api/household`, {
      headers: {
        "oai-authenticated-user-id": "spoof",
        "oai-authenticated-user-email": "seedy@sites.test",
      },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).not.toHaveProperty("data");
    const write = await isolated.request.put(`${origin}/api/household`, {
      headers: { Origin: origin, "If-Match": '"0"' },
      data: { data: {} },
    });
    expect(write.status()).toBe(401);
  } finally {
    await isolated.close();
  }
});
test("separate browsers share records and stale writes are rejected", async ({
  page,
  browser,
  context,
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
  await dialog.getByRole("button", { name: "Save changes" }).click();
  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await other.goto("/");
    await expect(
      other.getByRole("button", { name: "Update balances" }),
    ).toBeEnabled();
    await nav(other, "Expenses").click();
    await expect(
      other.locator(".summary-band .metric-number").first(),
    ).toContainText("400,00");
    const a = await (
      await context.request.get(`${origin}/api/household`)
    ).json();
    const stale = structuredClone(a);
    a.data.monthlyExpenses[0].amount = 45000;
    expect(
      (
        await context.request.put(`${origin}/api/household`, {
          headers: { Origin: origin, "If-Match": `"${a.revision}"` },
          data: { data: a.data },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await second.request.put(`${origin}/api/household`, {
          headers: { Origin: origin, "If-Match": `"${stale.revision}"` },
          data: { data: stale.data },
        })
      ).status(),
    ).toBe(409);
    await other
      .getByRole("button", { name: "Refresh records", exact: true })
      .click();
    await expect(
      other.locator(".summary-band .metric-number").first(),
    ).toContainText("450,00");
  } finally {
    await second.close();
  }
});
test("legacy browser records require confirmation before migration and remain recoverable", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update balances" }),
  ).toBeEnabled();
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("wealth-tracker");
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(
          ["categories", "monthlyExpenses"],
          "readwrite",
        );
        transaction
          .objectStore("categories")
          .put({ id: "local-cat", name: "Old browser category" });
        transaction.objectStore("monthlyExpenses").put({
          id: "local-cost",
          month: "2026-10",
          categoryId: "local-cat",
          amount: 12345,
          note: "",
        });
        transaction.oncomplete = () => {
          db.close();
          resolve(null);
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(
    page.getByText("Browser-only records found on this device"),
  ).toBeVisible();
  const before = await (
    await context.request.get(`${origin}/api/household`)
  ).json();
  expect(before.data.monthlyExpenses).toHaveLength(0);
  await page.getByRole("button", { name: "Review browser migration" }).click();
  const dialog = page.getByRole("dialog", { name: "Review your backup" });
  await expect(dialog).toContainText("EVERY invited member");
  await dialog.getByRole("button", { name: "Replace & restore" }).click();
  const after = await (
    await context.request.get(`${origin}/api/household`)
  ).json();
  expect(after.data.monthlyExpenses[0].amount).toBe(12345);
  await expect(
    page.getByText("Browser-only records found on this device"),
  ).toBeVisible();
});
