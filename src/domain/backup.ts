import {
  type Data,
  emptyData,
  validDate,
  validMonth,
  projection,
} from "./model";
export type Backup = {
  app: "wealth-tracker";
  schemaVersion: 2;
  exportedAt: string;
  data: Data;
};
const assert: (ok: unknown, message: string) => asserts ok = (ok, message) => {
  if (!ok) throw new Error(message);
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 250) =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const money = (v: unknown) =>
  typeof v === "number" &&
  Number.isSafeInteger(v) &&
  v >= 0 &&
  v <= 100_000_000_000;
export function validateData(value: unknown): Data {
  assert(object(value), "Backup data must be an object.");
  const keys = Object.keys(emptyData());
  assert(
    Object.keys(value).every((k) => keys.includes(k)) &&
      keys.every((k) => k in value),
    "Backup must include all supported record collections and settings.",
  );
  for (const key of keys.filter((k) => k !== "settings")) {
    const rows = value[key];
    assert(
      Array.isArray(rows) && rows.length <= 50000,
      `Invalid or oversized ${key} collection.`,
    );
    const ids = new Set<string>();
    for (const row of rows) {
      assert(object(row) && text(row.id, 100), `Invalid ${key} record ID.`);
      assert(!ids.has(row.id as string), `Duplicate ID in ${key}.`);
      ids.add(row.id as string);
    }
  }
  const data = value as unknown as Data;
  const accounts = new Set(data.accounts.map((x) => x.id));
  const categories = new Set(data.categories.map((x) => x.id));
  const unique = new Set<string>();
  for (const a of data.accounts)
    assert(
      text(a.name, 80) &&
        ["brokerage", "bank", "savings"].includes(a.type) &&
        a.currency === "EUR",
      "Invalid account.",
    );
  for (const c of data.categories)
    assert(text(c.name, 60), "Invalid category.");
  assert(
    new Set(data.categories.map((c) => c.name.trim().toLowerCase())).size ===
      data.categories.length,
    "Category names must be unique.",
  );
  for (const e of data.monthlyExpenses) {
    assert(
      validMonth(e.month) &&
        categories.has(e.categoryId) &&
        money(e.amount) &&
        e.amount > 0 &&
        typeof e.note === "string" &&
        e.note.length <= 500,
      "Invalid monthly expense or missing category.",
    );
    const key = `${e.month}:${e.categoryId}`;
    assert(!unique.has(key), "Duplicate month/category total.");
    unique.add(key);
  }
  unique.clear();
  for (const p of data.payments) {
    assert(
      validDate(p.date) &&
        typeof p.description === "string" &&
        p.description.length <= 250 &&
        money(p.amount) &&
        p.amount > 0 &&
        ["debit", "credit"].includes(p.direction) &&
        categories.has(p.categoryId) &&
        (p.importBatchId === undefined || text(p.importBatchId, 100)),
      "Invalid payment or missing category.",
    );
  }
  for (const s of data.assetSnapshots) {
    assert(
      validDate(s.date) &&
        accounts.has(s.accountId) &&
        money(s.cash) &&
        money(s.investments),
      "Invalid asset snapshot or missing account.",
    );
    const key = `${s.accountId}:${s.date}`;
    assert(!unique.has(key), "Duplicate account/date snapshot.");
    unique.add(key);
  }
  for (const f of data.cashFlows) {
    assert(
      validDate(f.date) &&
        accounts.has(f.accountId) &&
        money(f.amount) &&
        f.amount > 0 &&
        ["contribution", "withdrawal", "transfer-in", "transfer-out"].includes(
          f.kind,
        ),
      "Invalid cash flow.",
    );
    if (f.kind.startsWith("transfer-")) {
      assert(text(f.pairId, 100), "A transfer needs a pair ID.");
      const pair = data.cashFlows.filter((p) => p.pairId === f.pairId);
      assert(
        pair.length === 2 &&
          pair[0].accountId !== pair[1].accountId &&
          pair[0].amount === pair[1].amount &&
          pair[0].date === pair[1].date &&
          new Set(pair.map((p) => p.kind)).size === 2 &&
          pair.every((p) => p.kind.startsWith("transfer-")),
        "Invalid paired transfer.",
      );
    } else
      assert(
        f.pairId === undefined,
        "External cash flow cannot have a transfer pair.",
      );
  }
  for (const s of data.scenarios) {
    assert(
      text(s.name, 80) && money(s.initial) && money(s.monthly),
      "Invalid projection scenario.",
    );
    projection(s);
  }
  assert(object(data.settings), "Invalid settings.");
  assert(
    Object.keys(data.settings).every((k) =>
      ["lastExportAt", "demo"].includes(k),
    ),
    "Unsupported settings.",
  );
  assert(
    data.settings.demo === undefined || typeof data.settings.demo === "boolean",
    "Invalid demo setting.",
  );
  assert(
    data.settings.lastExportAt === undefined ||
      (typeof data.settings.lastExportAt === "string" &&
        Number.isFinite(Date.parse(data.settings.lastExportAt))),
    "Invalid export timestamp.",
  );
  // Strip unknown record fields so a restore can never carry arbitrary runtime properties.
  return {
    accounts: data.accounts.map(({ id, name, type, currency }) => ({
      id,
      name,
      type,
      currency,
    })),
    categories: data.categories.map(({ id, name }) => ({ id, name })),
    monthlyExpenses: data.monthlyExpenses.map(
      ({ id, month, categoryId, amount, note }) => ({
        id,
        month,
        categoryId,
        amount,
        note,
      }),
    ),
    payments: data.payments.map(
      ({
        id,
        date,
        description,
        amount,
        direction,
        categoryId,
        importBatchId,
      }) => ({
        id,
        date,
        description,
        amount,
        direction,
        categoryId,
        ...(importBatchId ? { importBatchId } : {}),
      }),
    ),
    assetSnapshots: data.assetSnapshots.map(
      ({ id, accountId, date, cash, investments }) => ({
        id,
        accountId,
        date,
        cash,
        investments,
      }),
    ),
    cashFlows: data.cashFlows.map(
      ({ id, accountId, date, amount, kind, pairId }) => ({
        id,
        accountId,
        date,
        amount,
        kind,
        ...(pairId ? { pairId } : {}),
      }),
    ),
    scenarios: data.scenarios.map(
      ({ id, name, initial, monthly, annualRate, years, inflation }) => ({
        id,
        name,
        initial,
        monthly,
        annualRate,
        years,
        inflation,
      }),
    ),
    settings: { ...data.settings },
  };
}
export const makeBackup = (
  data: Data,
  exportedAt = new Date().toISOString(),
): Backup => ({
  app: "wealth-tracker",
  schemaVersion: 2,
  exportedAt,
  data: validateData(data),
});
export function parseBackup(raw: string): Backup {
  if (new TextEncoder().encode(raw).byteLength > 10 * 1024 * 1024)
    throw new Error("Backup must be smaller than 10 MB.");
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  assert(
    object(b) && b.app === "wealth-tracker",
    "This is not a Wealth Tracker backup.",
  );
  assert(
    b.schemaVersion === 1 || b.schemaVersion === 2,
    "Unsupported backup version. Your current records have not been changed.",
  );
  assert(
    typeof b.exportedAt === "string" &&
      Number.isFinite(Date.parse(b.exportedAt)),
    "Invalid backup export date.",
  );
  assert(
    !(b.schemaVersion === 1 && object(b.data) && "payments" in b.data),
    "Legacy version 1 backups cannot contain payment records. Check the backup version.",
  );
  return {
    app: "wealth-tracker",
    schemaVersion: 2,
    exportedAt: b.exportedAt,
    data: validateData(
      b.schemaVersion === 1 && object(b.data)
        ? { ...b.data, payments: [] }
        : b.data,
    ),
  };
}
