import {
  type Data,
  type Payment,
  moneyInput,
  moneyText,
  validDate,
  uid,
  today,
} from "./model";
export type ReviewRow = {
  id: string;
  selected: boolean;
  date: string;
  description: string;
  amount: string;
  direction: "debit" | "credit" | "unknown";
  category: string;
  allowDuplicate: boolean;
  note: string;
};
export type ConflictChoice = "keep-manual" | "use-payments";
export const paymentKey = (
  p: Pick<Payment, "date" | "description" | "amount" | "direction">,
) =>
  `${p.date}|${p.description
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")}|${p.amount}|${p.direction}`;
export const categoryKey = (month: string, name: string) =>
  `${month}|${name.trim().toLocaleLowerCase()}`;
export function monthlySpending(data: Data, month: string) {
  return data.categories
    .map((category) => {
      const manual = data.monthlyExpenses.find(
        (e) => e.month === month && e.categoryId === category.id,
      );
      const payments = data.payments.filter(
        (p) =>
          p.date.slice(0, 7) === month &&
          p.categoryId === category.id &&
          p.direction === "debit",
      );
      return {
        id: manual?.id ?? `payments-${category.id}`,
        note: manual?.note ?? `${payments.length} outgoing payment(s)`,
        categoryId: category.id,
        amount:
          manual?.amount ?? payments.reduce((sum, p) => sum + p.amount, 0),
        manual,
        paymentCount: payments.length,
        paymentAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      };
    })
    .filter((x) => x.manual || x.paymentCount);
}
export function suggestCategory(description: string): string {
  const rules: [RegExp, string][] = [
    [
      /\b(rewe|edeka|aldi|lidl|netto|kaufland|penny|supermarket|grocery)\b/i,
      "Groceries",
    ],
    [
      /\b(db|bahn|bvg|mvv|train|ticket|uber|bolt|shell|aral|transport)\b/i,
      "Transport",
    ],
    [
      /\b(restaurant|cafe|café|coffee|bistro|lieferando|wolt|pizza)\b/i,
      "Dining",
    ],
    [/\b(rent|miete|landlord|housing)\b/i, "Housing"],
    [/\b(cinema|kino|netflix|spotify|museum)\b/i, "Leisure"],
  ];
  return rules.find(([pattern]) => pattern.test(description))?.[1] ?? "Other";
}
export function rowProblems(row: ReviewRow): string[] {
  const issues: string[] = [];
  if (!validDate(row.date) || row.date > today())
    issues.push("Set a valid payment date (not in the future).");
  if (!row.description.trim() || row.description.length > 250)
    issues.push("Description is required (up to 250 characters).");
  try {
    if (moneyInput(row.amount) <= 0)
      issues.push("Amount must be greater than zero.");
  } catch {
    issues.push("Check amount: use 1.250,50.");
  }
  if (!["debit", "credit"].includes(row.direction))
    issues.push("Choose outgoing or incoming.");
  if (!row.category.trim() || row.category.trim().length > 60)
    issues.push("Set a category (up to 60 characters).");
  return issues;
}
export function rowPayment(row: ReviewRow): Payment {
  const issues = rowProblems(row);
  if (issues.length) throw new Error(issues[0]);
  return {
    id: row.id,
    date: row.date,
    description: row.description.trim(),
    amount: moneyInput(row.amount),
    direction: row.direction as "debit" | "credit",
    categoryId: "",
  };
}
export function duplicateIds(rows: ReviewRow[], data: Data): Set<string> {
  const seen = new Set(data.payments.map(paymentKey)),
    ids = new Set<string>();
  for (const row of rows) {
    if (rowProblems(row).length) continue;
    const key = paymentKey(rowPayment(row));
    if (seen.has(key)) ids.add(row.id);
    if (row.selected) seen.add(key);
  }
  return ids;
}
export function importConflicts(rows: ReviewRow[], data: Data) {
  const groups = new Map<
    string,
    {
      key: string;
      month: string;
      category: string;
      manualAmount: number;
      paymentAmount: number;
    }
  >();
  for (const row of rows.filter((r) => r.selected && r.direction === "debit")) {
    const category = data.categories.find(
      (c) => c.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
    );
    const manual = data.monthlyExpenses.find(
      (e) => e.month === row.date.slice(0, 7) && e.categoryId === category?.id,
    );
    if (!manual) continue;
    const key = categoryKey(manual.month, row.category);
    let amount = 0;
    try {
      amount = moneyInput(row.amount);
    } catch {}
    const existing = groups.get(key);
    if (existing) existing.paymentAmount += amount;
    else
      groups.set(key, {
        key,
        month: manual.month,
        category: category!.name,
        manualAmount: manual.amount,
        paymentAmount:
          amount +
          data.payments
            .filter(
              (p) =>
                p.categoryId === category!.id &&
                p.direction === "debit" &&
                p.date.startsWith(manual.month),
            )
            .reduce((s, p) => s + p.amount, 0),
      });
  }
  return [...groups.values()];
}
export function applyPaymentImport(
  data: Data,
  rows: ReviewRow[],
  choices: Record<string, ConflictChoice>,
): Data {
  const selected = rows.filter((r) => r.selected);
  if (!selected.length) throw new Error("Select at least one payment.");
  if (rows.length > 500)
    throw new Error("Review up to 500 payments per import.");
  const duplicates = duplicateIds(rows, data);
  for (const row of selected) {
    const problems = rowProblems(row);
    if (problems.length) throw new Error(problems[0]);
    if (duplicates.has(row.id) && !row.allowDuplicate)
      throw new Error(
        "Confirm legitimate duplicate payments or deselect them.",
      );
  }
  const conflicts = importConflicts(rows, data);
  for (const conflict of conflicts)
    if (!["keep-manual", "use-payments"].includes(choices[conflict.key]))
      throw new Error("Choose how to handle each existing monthly total.");
  const next = structuredClone(data),
    batch = uid();
  for (const row of selected) {
    let category = next.categories.find(
      (c) => c.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
    );
    if (!category) {
      category = { id: uid(), name: row.category.trim() };
      next.categories.push(category);
    }
    next.payments.push({
      ...rowPayment(row),
      id: uid(),
      categoryId: category.id,
      importBatchId: batch,
    });
  }
  const replaceKeys = new Set(
    conflicts
      .filter((c) => choices[c.key] === "use-payments")
      .map((c) => c.key),
  );
  next.monthlyExpenses = next.monthlyExpenses.filter(
    (e) =>
      !replaceKeys.has(
        categoryKey(
          e.month,
          next.categories.find((c) => c.id === e.categoryId)!.name,
        ),
      ),
  );
  return next;
}
export function paymentToReview(payment: Payment, data: Data): ReviewRow {
  return {
    id: payment.id,
    selected: true,
    date: payment.date,
    description: payment.description,
    amount: moneyText(payment.amount),
    direction: payment.direction,
    category:
      data.categories.find((c) => c.id === payment.categoryId)?.name ?? "Other",
    allowDuplicate: false,
    note: "",
  };
}
