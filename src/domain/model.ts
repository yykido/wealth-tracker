export type Account = {
  id: string;
  name: string;
  type: "brokerage" | "bank" | "savings";
  currency: "EUR";
};
export type Category = { id: string; name: string };
export type Expense = {
  id: string;
  month: string;
  categoryId: string;
  amount: number;
  note: string;
};
export type Snapshot = {
  id: string;
  accountId: string;
  date: string;
  cash: number;
  investments: number;
};
export type CashFlow = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  kind: "contribution" | "withdrawal" | "transfer-in" | "transfer-out";
  pairId?: string;
};
export type Scenario = {
  id: string;
  name: string;
  initial: number;
  monthly: number;
  annualRate: number;
  years: number;
  inflation: number;
};
export type Settings = { lastExportAt?: string; demo?: boolean };
export type Data = {
  accounts: Account[];
  categories: Category[];
  monthlyExpenses: Expense[];
  assetSnapshots: Snapshot[];
  cashFlows: CashFlow[];
  scenarios: Scenario[];
  settings: Settings;
};
export const emptyData = (): Data => ({
  accounts: [],
  categories: [],
  monthlyExpenses: [],
  assetSnapshots: [],
  cashFlows: [],
  scenarios: [],
  settings: {},
});
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const euro = (cents: number, decimals = 0) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(cents / 100);
export const compactEuro = (euros: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(euros);
// Euro input uses German notation. A dot is a thousands separator, a comma is decimal.
export function moneyInput(text: string): number {
  const input = text.trim().replace(/\s|€/g, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input))
    throw new Error("Use a euro amount such as 1.250,50 (comma for decimals).");
  const value = Math.round(
    Number(input.replace(/\./g, "").replace(",", ".")) * 100,
  );
  if (!Number.isSafeInteger(value) || value > 100_000_000_000)
    throw new Error(
      "Amount is outside the supported range (up to €1 billion).",
    );
  return value;
}
export const moneyText = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value &&
  value >= "1900-01-01" &&
  value <= "2200-12-31";
export const validMonth = (value: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
  value >= "1900-01" &&
  value <= "2200-12";
export function latestSnapshots(data: Data, asOf = "9999-12-31"): Snapshot[] {
  return data.accounts.flatMap((account) => {
    const last = data.assetSnapshots
      .filter((s) => s.accountId === account.id && s.date <= asOf)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return last ? [last] : [];
  });
}
export function assetHistory(data: Data) {
  return [...new Set(data.assetSnapshots.map((s) => s.date))]
    .sort()
    .map((date) => ({
      date,
      value:
        latestSnapshots(data, date).reduce(
          (sum, s) => sum + s.cash + s.investments,
          0,
        ) / 100,
    }));
}
export function projection(s: Scenario) {
  if (
    ![s.initial, s.monthly, s.annualRate, s.years, s.inflation].every(
      Number.isFinite,
    ) ||
    s.initial < 0 ||
    s.monthly < 0 ||
    s.annualRate <= -1 ||
    s.annualRate > 1 ||
    s.inflation <= -1 ||
    s.inflation > 1 ||
    !Number.isInteger(s.years) ||
    s.years < 1 ||
    s.years > 60
  )
    throw new Error(
      "Use a duration of 1–60 years and rates greater than −100% and no more than 100%.",
    );
  const rate = Math.pow(1 + s.annualRate, 1 / 12) - 1;
  let balance = s.initial / 100;
  const points = [{ year: 0, balance, contributions: balance, real: balance }];
  for (let m = 1; m <= s.years * 12; m++) {
    balance = balance * (1 + rate) + s.monthly / 100;
    if (!Number.isFinite(balance))
      throw new Error(
        "This scenario produces values outside the supported range.",
      );
    if (m % 12 === 0)
      points.push({
        year: m / 12,
        balance,
        contributions: (s.initial + s.monthly * m) / 100,
        real: balance / Math.pow(1 + s.inflation, m / 12),
      });
  }
  return points;
}
