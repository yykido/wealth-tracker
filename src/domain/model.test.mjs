import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  moneyInput,
  projection,
  assetHistory,
  validDate,
} from "./model.ts";
import { demoData } from "../demo/data.ts";
import { makeBackup, parseBackup } from "./backup.ts";
function expect(value) {
  return {
    toBe: (expected) => assert.equal(value, expected),
    toEqual: (expected) => assert.deepEqual(value, expected),
    toHaveLength: (expected) => assert.equal(value.length, expected),
    toBeCloseTo: (expected, digits) =>
      assert.ok(
        Math.abs(value - expected) < 10 ** -digits,
        `${value} differs from ${expected}`,
      ),
    toThrow: (message) =>
      assert.throws(value, message ? new RegExp(message) : undefined),
  };
}
const scenario = {
  id: "test",
  name: "Test",
  initial: 100000,
  monthly: 20000,
  annualRate: 0,
  years: 10,
  inflation: 0.02,
};
describe("financial calculations", () => {
  it("preserves contributions with zero return", () => {
    expect(projection(scenario).at(-1)?.balance).toBe(25000);
  });
  it("uses effective annual rates and month-end contributions", () => {
    const final = projection({ ...scenario, annualRate: 0.1, years: 1 }).at(-1);
    const r = 1.1 ** (1 / 12) - 1;
    expect(final.balance).toBeCloseTo(
      1000 * 1.1 + (200 * ((1 + r) ** 12 - 1)) / r,
      8,
    );
    expect(final.contributions).toBe(3400);
    expect(final.real).toBeCloseTo(final.balance / 1.02, 8);
  });
  it("handles losses without changing contributed capital", () => {
    const final = projection({
      ...scenario,
      annualRate: -0.25,
      monthly: 0,
      years: 1,
    }).at(-1);
    expect(final.balance).toBeCloseTo(750, 8);
    expect(final.contributions).toBe(1000);
  });
  it("rejects invalid scenarios and parses German currency precisely", () => {
    expect(() => projection({ ...scenario, annualRate: -1 })).toThrow();
    expect(() => projection({ ...scenario, years: Infinity })).toThrow();
    expect(moneyInput("1.250,50")).toBe(125050);
    expect(moneyInput("0,01")).toBe(1);
    expect(() => moneyInput("12.50")).toThrow();
    expect(() => moneyInput("-10")).toThrow();
    expect(validDate("2026-02-30")).toBe(false);
  });
  it("uses the latest snapshot per account as of each date, not their sum", () => {
    const d = emptyData();
    d.accounts = [
      { id: "a", name: "Account A", type: "bank", currency: "EUR" },
      { id: "b", name: "Account B", type: "bank", currency: "EUR" },
    ];
    d.assetSnapshots = [
      {
        id: "1",
        accountId: "a",
        date: "2026-01-01",
        cash: 10000,
        investments: 0,
      },
      {
        id: "2",
        accountId: "a",
        date: "2026-02-01",
        cash: 20000,
        investments: 0,
      },
      {
        id: "3",
        accountId: "b",
        date: "2026-02-01",
        cash: 5000,
        investments: 0,
      },
    ];
    expect(assetHistory(d)).toEqual([
      { date: "2026-01-01", value: 100 },
      { date: "2026-02-01", value: 250 },
    ]);
  });
});
describe("backup validation", () => {
  it("round-trips every collection and settings", () => {
    const data = demoData();
    data.settings.lastExportAt = "2026-10-24T12:00:00Z";
    expect(parseBackup(JSON.stringify(makeBackup(data))).data).toEqual(data);
  });
  it("rejects broken versions, dates, references, duplicates, and invalid money", () => {
    const raw = () => makeBackup(demoData());
    const version = { ...raw(), schemaVersion: 3 };
    expect(() => parseBackup(JSON.stringify(version))).toThrow("version");
    const missing = raw();
    missing.data.assetSnapshots[0].accountId = "missing";
    expect(() => parseBackup(JSON.stringify(missing))).toThrow("account");
    const duplicate = raw();
    duplicate.data.monthlyExpenses.push({
      ...duplicate.data.monthlyExpenses[0],
      id: "duplicate",
    });
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow(
      "Duplicate month",
    );
    const bad = raw();
    bad.data.monthlyExpenses[0].amount = 0.5;
    expect(() => parseBackup(JSON.stringify(bad))).toThrow("expense");
    const invalidDate = raw();
    invalidDate.data.assetSnapshots[0].date = "2026-02-30";
    expect(() => parseBackup(JSON.stringify(invalidDate))).toThrow("snapshot");
    expect(() => parseBackup("{")).toThrow("JSON");
  });
  it("rejects missing collections and orphan transfer records", () => {
    const b = makeBackup(demoData());
    delete b.data.categories;
    expect(() => parseBackup(JSON.stringify(b))).toThrow("collections");
    const transfer = makeBackup(demoData());
    transfer.data.cashFlows.push({
      id: "transfer",
      accountId: transfer.data.accounts[0].id,
      amount: 100,
      date: "2026-01-01",
      kind: "transfer-out",
      pairId: "missing",
    });
    expect(() => parseBackup(JSON.stringify(transfer))).toThrow("paired");
  });
  it("accepts matched internal transfers without treating them as external contributions", () => {
    const d = demoData();
    d.cashFlows = [
      {
        id: "in",
        accountId: d.accounts[0].id,
        amount: 100,
        date: "2026-01-01",
        kind: "transfer-in",
        pairId: "pair",
      },
      {
        id: "out",
        accountId: d.accounts[1].id,
        amount: 100,
        date: "2026-01-01",
        kind: "transfer-out",
        pairId: "pair",
      },
    ];
    expect(
      parseBackup(JSON.stringify(makeBackup(d))).data.cashFlows,
    ).toHaveLength(2);
  });
});
