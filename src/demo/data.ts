import { type Data, today } from "../domain/model";
export function demoData(): Data {
  const now = today();
  const current = new Date(now + "T12:00:00");
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(
      current.getFullYear(),
      current.getMonth() - 5 + i,
      1,
      12,
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const categoryNames = [
    "Housing",
    "Groceries",
    "Transport",
    "Dining",
    "Leisure",
    "Other",
  ];
  return {
    accounts: [
      {
        id: "demo-broker",
        name: "Example brokerage",
        type: "brokerage",
        currency: "EUR",
      },
      {
        id: "demo-bank",
        name: "Everyday account",
        type: "bank",
        currency: "EUR",
      },
      {
        id: "demo-save",
        name: "Savings account",
        type: "savings",
        currency: "EUR",
      },
    ],
    categories: categoryNames.map((name, i) => ({ id: `cat-${i}`, name })),
    monthlyExpenses: months.flatMap((month, i) =>
      [
        95000,
        36500 + i * 600,
        6900,
        14800 + i * 300,
        12000 - i * 300,
        8700,
      ].map((amount, j) => ({
        id: `expense-${i}-${j}`,
        month,
        categoryId: `cat-${j}`,
        amount,
        note: "",
      })),
    ),
    payments: [],
    assetSnapshots: months.flatMap((month, i) => [
      {
        id: `snap-b-${i}`,
        accountId: "demo-broker",
        date: month + "-01",
        cash: 35000,
        investments: [1280000, 1350000, 1330000, 1460000, 1520000, 1660000][i],
      },
      {
        id: `snap-c-${i}`,
        accountId: "demo-bank",
        date: month + "-01",
        cash: 420000 + i * 6000,
        investments: 0,
      },
      {
        id: `snap-s-${i}`,
        accountId: "demo-save",
        date: month + "-01",
        cash: 780000 + i * 20000,
        investments: 0,
      },
    ]),
    cashFlows: months.map((month, i) => ({
      id: `flow-${i}`,
      accountId: "demo-broker",
      date: month + "-01",
      amount: 50000,
      kind: "contribution",
    })),
    scenarios: [
      {
        id: "demo-scenario",
        name: "Long-term example",
        initial: 1660000,
        monthly: 50000,
        annualRate: 0.05,
        years: 20,
        inflation: 0.02,
      },
    ],
    settings: { demo: true },
  };
}
