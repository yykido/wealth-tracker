import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "./model.ts";
import { parseScreenshotText } from "./screenshot.ts";
import {
  applyPaymentImport,
  duplicateIds,
  monthlySpending,
  importConflicts,
} from "./payments.ts";
import { makeBackup, parseBackup } from "./backup.ts";
const scan = (text) => parseScreenshotText(text, 2026).rows;
const rows = () =>
  scan(
    "20.10.2026 REWE -42,80 €\n21.10.2026 DB ticket -29,90 €\n22.10.2026 Restaurant -35,00 €",
  );
describe("screenshot payment parsing", () => {
  it("extracts multiple payments with dates, signed amounts and suggested categories", () => {
    const result = rows();
    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((r) => [
        r.date,
        r.description,
        r.amount,
        r.direction,
        r.category,
      ]),
      [
        ["2026-10-20", "REWE", "42,80", "debit", "Groceries"],
        ["2026-10-21", "DB ticket", "29,90", "debit", "Transport"],
        ["2026-10-22", "Restaurant", "35,00", "debit", "Dining"],
      ],
    );
    assert.ok(result.every((r) => r.selected));
  });
  it("supports date headings and multi-line merchant entries without interpreting dates as money", () => {
    const result = scan(
      "20 October 2026\nREWE\n-42,80 €\n21.10\nDB ticket -29.90 EUR",
    );
    assert.equal(result.length, 2);
    assert.equal(result[0].description, "REWE");
    assert.equal(result[1].date, "2026-10-21");
    assert.match(result[1].note, /Year inferred/);
  });
  it("deselects incoming, unsigned, ambiguous and transfer-like rows; skips balances", () => {
    const result = scan(
      "20.10.2026 Salary +2.000,00 €\n20.10.2026 REWE 42,80 €\n20.10.2026 Transfer -50,00 €\n20.10.2026 Merchant -10,00 € 500,00 €\nBalance 5.000,00 €",
    );
    assert.equal(result.length, 4);
    assert.ok(result.every((r) => !r.selected));
    assert.equal(result[0].direction, "credit");
    assert.equal(result[1].direction, "unknown");
    assert.match(result[3].note, /Multiple/);
  });
  it("requires corrections for invalid dates and supports ISO dates and decimal dots", () => {
    const result = scan("2026-10-20 REWE -42.80 EUR\n31.02.2026 Shop -12,30 €");
    assert.equal(result[0].amount, "42,80");
    assert.equal(result[1].date, "");
    assert.equal(result[1].selected, false);
  });
});
describe("reviewed bulk import and totals", () => {
  it("imports every selected row and aggregates outgoing amounts without changing assets", () => {
    const original = emptyData(),
      next = applyPaymentImport(original, rows(), {});
    assert.equal(original.payments.length, 0);
    assert.equal(next.payments.length, 3);
    assert.equal(next.monthlyExpenses.length, 0);
    assert.equal(
      monthlySpending(next, "2026-10").reduce((s, e) => s + e.amount, 0),
      10770,
    );
    assert.deepEqual(next.assetSnapshots, []);
  });
  it("flags existing and in-batch duplicates and requires explicit override", () => {
    const result = rows(),
      data = applyPaymentImport(emptyData(), result, {});
    assert.equal(duplicateIds(result, data).size, 3);
    assert.throws(() => applyPaymentImport(data, result, {}), /duplicate/);
    const repeated = [result[0], { ...result[0], id: "second" }];
    assert.ok(duplicateIds(repeated, emptyData()).has("second"));
    assert.throws(
      () => applyPaymentImport(emptyData(), repeated, {}),
      /duplicate/,
    );
    repeated[1].allowDuplicate = true;
    assert.equal(
      applyPaymentImport(emptyData(), repeated, {}).payments.length,
      2,
    );
  });
  it("requires a choice for manual totals and avoids double counting with either choice", () => {
    const data = emptyData();
    data.categories = [{ id: "g", name: "Groceries" }];
    data.monthlyExpenses = [
      { id: "e", month: "2026-10", categoryId: "g", amount: 40000, note: "" },
    ];
    const selection = [rows()[0]];
    const conflict = importConflicts(selection, data)[0];
    assert.throws(
      () => applyPaymentImport(data, selection, {}),
      /monthly total/,
    );
    const keep = applyPaymentImport(data, selection, {
      [conflict.key]: "keep-manual",
    });
    assert.equal(monthlySpending(keep, "2026-10")[0].amount, 40000);
    assert.equal(keep.payments.length, 1);
    const replace = applyPaymentImport(data, selection, {
      [conflict.key]: "use-payments",
    });
    assert.equal(replace.monthlyExpenses.length, 0);
    assert.equal(monthlySpending(replace, "2026-10")[0].amount, 4280);
    assert.equal(data.monthlyExpenses.length, 1);
  });
  it("stores explicitly selected incoming payments without treating them as expenses", () => {
    const selection = scan("20.10.2026 Salary +2.000,00 €");
    selection[0].selected = true;
    const next = applyPaymentImport(emptyData(), selection, {});
    assert.equal(next.payments[0].amount, 200000);
    assert.equal(monthlySpending(next, "2026-10").length, 0);
  });
  it("rejects invalid selected rows and an empty selection before writing", () => {
    const selection = rows();
    selection[0].amount = "oops";
    assert.throws(
      () => applyPaymentImport(emptyData(), selection, {}),
      /amount/i,
    );
    assert.throws(() => applyPaymentImport(emptyData(), [], {}), /Select/);
  });
});
describe("payment backup compatibility", () => {
  it("round-trips payments in version 2 and migrates legacy version 1", () => {
    const data = applyPaymentImport(emptyData(), rows(), {});
    assert.deepEqual(parseBackup(JSON.stringify(makeBackup(data))).data, data);
    const legacy = makeBackup(emptyData());
    legacy.schemaVersion = 1;
    delete legacy.data.payments;
    const restored = parseBackup(JSON.stringify(legacy));
    assert.equal(restored.schemaVersion, 2);
    assert.deepEqual(restored.data.payments, []);
  });
  it("rejects a version 2 backup missing payments or containing invalid payment references", () => {
    const backup = makeBackup(emptyData());
    delete backup.data.payments;
    assert.throws(() => parseBackup(JSON.stringify(backup)), /collections/);
    const broken = makeBackup(applyPaymentImport(emptyData(), rows(), {}));
    broken.data.payments[0].categoryId = "missing";
    assert.throws(() => parseBackup(JSON.stringify(broken)), /payment/);
  });
});

describe("optional payment descriptions", () => {
  it("imports blank descriptions, trims whitespace, and round-trips them through backups", () => {
    const selection = rows();
    selection[0].description = "";
    selection[1].description = "   ";
    const next = applyPaymentImport(emptyData(), selection, {});
    assert.equal(next.payments[0].description, "");
    assert.equal(next.payments[1].description, "");
    assert.deepEqual(parseBackup(JSON.stringify(makeBackup(next))).data, next);
  });
  it("still flags possible duplicates with no description and enforces the length limit", () => {
    const selection = [{ ...rows()[0], description: "" }];
    const next = applyPaymentImport(emptyData(), selection, {});
    assert.ok(duplicateIds(selection, next).has(selection[0].id));
    assert.throws(() => applyPaymentImport(next, selection, {}), /duplicate/);
    selection[0].description = "x".repeat(251);
    assert.throws(() => applyPaymentImport(emptyData(), selection, {}), /250/);
  });
});
