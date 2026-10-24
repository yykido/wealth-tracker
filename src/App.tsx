import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  X,
  Wallet,
  Landmark,
  TrendingUp,
  ChevronRight,
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  Trash2,
  Pencil,
  ChartNoAxesCombined,
  CircleHelp,
  Check,
  AlertTriangle,
  Database,
  Sparkles,
  ScanLine,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  assetHistory,
  compactEuro,
  emptyData,
  euro,
  latestSnapshots,
  moneyInput,
  moneyText,
  projection,
  today,
  uid,
  type Account,
  type Data,
  type Scenario,
} from "./domain/model";
import { makeBackup, parseBackup, type Backup } from "./domain/backup";
import { db } from "./storage/database";
import { demoData } from "./demo/data";
import PaymentImport from "./features/import/PaymentImport";
import PaymentsPanel from "./features/import/PaymentsPanel";
import { monthlySpending } from "./domain/payments";

type Page =
  "Overview" | "Expenses" | "Assets" | "Projections" | "Data & backup";
type Modal = {
  kind: "expense" | "snapshot" | "account" | "flow" | "payment";
  id?: string;
  accountId?: string;
} | null;
type Confirmation = {
  title: string;
  description: string;
  label: string;
  danger?: boolean;
  action: () => Promise<void>;
} | null;
const pages: Page[] = [
  "Overview",
  "Expenses",
  "Assets",
  "Projections",
  "Data & backup",
];
const colors = [
  "#171717",
  "#626b64",
  "#a2b494",
  "#c4d4ac",
  "#e0e6d7",
  "#a5a5a5",
];
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const monthLabel = (s: string) =>
  new Date(s + "-01T12:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
const accountIcon = (type: string) =>
  type === "brokerage" ? (
    <TrendingUp size={20} />
  ) : type === "bank" ? (
    <Landmark size={20} />
  ) : (
    <Wallet size={20} />
  );
const fvalue = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function ModalFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal">
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ChartNoAxesCombined size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Money({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return <span className={`money ${className}`}>{euro(value, 2)}</span>;
}
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <span>{String(label)}</span>
      {payload.map((p: any) => (
        <strong key={p.dataKey}>
          {p.name}: {euro(p.value * 100)}
        </strong>
      ))}
    </div>
  );
}
function TrendChart({
  data,
  height = 250,
}: {
  data: ReturnType<typeof assetHistory>;
  height?: number;
}) {
  return (
    <div
      role="img"
      aria-label="Recorded total asset values over time"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 12, bottom: 0, left: 4 }}
        >
          <defs>
            <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b4ce8a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#b4ce8a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#efefef" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) =>
              new Date(v + "T12:00:00").toLocaleDateString("en-GB", {
                month: "short",
                day: "numeric",
              })
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8b8b8b", fontSize: 11 }}
            minTickGap={35}
            dy={10}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip content={<ChartTip />} />
          <Area
            isAnimationActive={false}
            dataKey="value"
            name="Recorded assets"
            type="linear"
            stroke="#7c9a56"
            strokeWidth={2.5}
            fill="url(#assetFill)"
            dot={data.length < 3}
            activeDot={{ r: 5, fill: "#171717" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true),
    [storageReady, setStorageReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal>(null),
    [confirm, setConfirm] = useState<Confirmation>(null),
    [backup, setBackup] = useState<Backup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [range, setRange] = useState<"6M" | "1Y" | "ALL">("ALL");
  const [expenseCategory, setExpenseCategory] = useState("new");
  const [scenario, setScenario] = useState<Scenario>({
    id: "",
    name: "My projection",
    initial: 0,
    monthly: 20000,
    annualRate: 0.05,
    years: 20,
    inflation: 0.02,
  });
  const [selectedScenario, setSelectedScenario] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  useEffect(() => {
    db.read()
      .then((d) => {
        setData(d);
        setStorageReady(true);
      })
      .catch(() =>
        setError(
          "Browser storage is unavailable. Enable website storage and reload. Your existing records have not been changed.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const write = async (next: Data, message: string) => {
    if (!storageReady)
      throw new Error(
        "Browser storage is unavailable. Please reload after enabling website storage.",
      );
    if (saving.current)
      throw new Error("A save is already in progress. Please wait.");
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await db.replace(next, data);
      setData(await db.read());
      setNotice(message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Your changes were not saved.",
      );
    }
  };
  const snapshots = latestSnapshots(data),
    total = snapshots.reduce((sum, s) => sum + s.cash + s.investments, 0);
  const cash = snapshots.reduce((sum, s) => sum + s.cash, 0),
    investments = total - cash;
  const expenses = monthlySpending(data, month),
    expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const history = assetHistory(data);
  const filteredHistory = history.filter(
    (p) =>
      range === "ALL" ||
      p.date >=
        (() => {
          const d = new Date(today() + "T12:00:00");
          d.setMonth(d.getMonth() - (range === "6M" ? 6 : 12));
          return d.toISOString().slice(0, 10);
        })(),
  );
  const oldest = history[0]?.value * 100 || 0,
    delta = total - oldest;
  const lastUpdate = [...data.assetSnapshots].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0]?.date;
  const categoryTotals = data.categories
    .map((c, i) => ({
      ...c,
      amount: expenses
        .filter((e) => e.categoryId === c.id)
        .reduce((sum, e) => sum + e.amount, 0),
      color: colors[i % colors.length],
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const go = (p: Page) => {
    setPage(p);
    setError("");
  };
  const openExpense = (id?: string) => {
    setExpenseCategory(
      data.monthlyExpenses.find((e) => e.id === id)?.categoryId ??
        data.categories[0]?.id ??
        "new",
    );
    setModal({ kind: "expense", id });
  };
  const openSnapshot = (accountId?: string, id?: string) => {
    setModal(
      data.accounts.length
        ? { kind: "snapshot", accountId, id }
        : { kind: "account" },
    );
  };
  const remove = (
    title: string,
    description: string,
    action: () => Promise<void>,
  ) =>
    setConfirm({ title, description, label: "Delete", danger: true, action });
  const exportBackup = async () => {
    const time = new Date().toISOString();
    const blob = new Blob([JSON.stringify(makeBackup(data, time), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wealth-tracker-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await write(
      { ...data, settings: { ...data.settings, lastExportAt: time } },
      "Backup downloaded. Keep the file somewhere private.",
    );
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Backup must be smaller than 10 MB.");
      setBackup(parseBackup(await file.text()));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read this backup.");
    }
  };
  const showDemo = () =>
    setConfirm({
      title: "Explore with example data?",
      description:
        "This replaces this browser’s current records with fictional examples. Export a backup first if you have records to keep.",
      label: "Load example data",
      action: async () => {
        await write(demoData(), "Fictional example data loaded.");
        setConfirm(null);
      },
    });
  const deleteSnapshot = (id: string) =>
    remove(
      "Delete this snapshot?",
      "Other snapshot dates and account details will be kept.",
      async () => {
        await write(
          {
            ...data,
            assetSnapshots: data.assetSnapshots.filter((s) => s.id !== id),
          },
          "Snapshot deleted.",
        );
        setConfirm(null);
      },
    );
  const saveForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!modal) return;
    await attempt(async () => {
      const next = structuredClone(data);
      if (modal.kind === "expense") {
        let categoryId = fvalue(f, "category");
        if (categoryId === "new") {
          const name = fvalue(f, "categoryName");
          if (!name) throw new Error("Enter a category name.");
          const existing = next.categories.find(
            (c) => c.name.toLowerCase() === name.toLowerCase(),
          );
          categoryId = existing?.id ?? uid();
          if (!existing) next.categories.push({ id: categoryId, name });
        }
        const m = fvalue(f, "month");
        const existing = next.monthlyExpenses.find(
          (x) => x.month === m && x.categoryId === categoryId,
        );
        if (existing && existing.id !== modal.id)
          throw new Error(
            "A total already exists for this month and category. Edit that entry instead.",
          );
        const record = {
          id: modal.id ?? uid(),
          month: m,
          categoryId,
          amount: moneyInput(fvalue(f, "amount")),
          note: fvalue(f, "note"),
        };
        next.monthlyExpenses = next.monthlyExpenses
          .filter((x) => x.id !== record.id)
          .concat(record);
        setMonth(m);
      }
      if (modal.kind === "payment") {
        const existing = next.payments.find((p) => p.id === modal.id);
        if (!existing) throw new Error("Payment no longer exists.");
        const record = {
          ...existing,
          date: fvalue(f, "date"),
          description: fvalue(f, "description"),
          amount: moneyInput(fvalue(f, "amount")),
          direction: fvalue(f, "direction") as "debit" | "credit",
          categoryId: fvalue(f, "category"),
        };
        next.payments = next.payments.map((p) =>
          p.id === record.id ? record : p,
        );
      }
      if (modal.kind === "account") {
        const id = modal.id ?? uid();
        const account: Account = {
          id,
          name: fvalue(f, "name"),
          type: fvalue(f, "type") as Account["type"],
          currency: "EUR",
        };
        next.accounts = next.accounts
          .filter((x) => x.id !== id)
          .concat(account);
      }
      if (modal.kind === "snapshot") {
        const accountId = fvalue(f, "accountId"),
          date = fvalue(f, "date");
        const existing = next.assetSnapshots.find(
          (x) => x.accountId === accountId && x.date === date,
        );
        if (existing && existing.id !== modal.id)
          throw new Error(
            "A snapshot exists for this account and date. Edit it in snapshot history.",
          );
        const record = {
          id: modal.id ?? uid(),
          accountId,
          date,
          cash: moneyInput(fvalue(f, "cash")),
          investments: moneyInput(fvalue(f, "investments")),
        };
        next.assetSnapshots = next.assetSnapshots
          .filter((x) => x.id !== record.id)
          .concat(record);
      }
      if (modal.kind === "flow") {
        const kind = fvalue(f, "kind"),
          amount = moneyInput(fvalue(f, "amount")),
          accountId = fvalue(f, "accountId"),
          date = fvalue(f, "date");
        if (kind === "transfer") {
          const destination = fvalue(f, "destination");
          if (destination === accountId)
            throw new Error("Choose a different destination account.");
          const pairId = uid();
          next.cashFlows.push(
            {
              id: uid(),
              accountId,
              date,
              amount,
              kind: "transfer-out",
              pairId,
            },
            {
              id: uid(),
              accountId: destination,
              date,
              amount,
              kind: "transfer-in",
              pairId,
            },
          );
        } else
          next.cashFlows.push({
            id: uid(),
            accountId,
            date,
            amount,
            kind: kind as "contribution" | "withdrawal",
          });
      }
      await write(next, "Changes saved in this browser.");
      setModal(null);
    });
  };
  let points: ReturnType<typeof projection> = [];
  let scenarioError = "";
  try {
    points = projection(scenario);
  } catch (e) {
    scenarioError = (e as Error).message;
  }
  const result = points.at(-1);
  const editingExpense = data.monthlyExpenses.find((x) => x.id === modal?.id);
  const editingSnapshot = data.assetSnapshots.find((x) => x.id === modal?.id);
  const editingAccount = data.accounts.find((x) => x.id === modal?.id);
  const editingPayment = data.payments.find((p) => p.id === modal?.id);
  const submitButtons = (
    <div className="modal-actions">
      <button
        type="button"
        className="btn secondary"
        onClick={() => setModal(null)}
        disabled={busy}
      >
        Cancel
      </button>
      <button className="btn" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
        <Check size={16} />
      </button>
    </div>
  );
  const deleteAccount = (account: Account) =>
    remove(
      "Delete account and its records?",
      `This removes ${account.name}, its snapshots, cash flows, and both sides of any associated transfers. Export a backup first to keep a copy.`,
      async () => {
        const pairs = new Set(
          data.cashFlows
            .filter((f) => f.accountId === account.id && f.pairId)
            .map((f) => f.pairId),
        );
        await write(
          {
            ...data,
            accounts: data.accounts.filter((a) => a.id !== account.id),
            assetSnapshots: data.assetSnapshots.filter(
              (s) => s.accountId !== account.id,
            ),
            cashFlows: data.cashFlows.filter(
              (f) => f.accountId !== account.id && !pairs.has(f.pairId),
            ),
          },
          "Account and related records deleted.",
        );
        setConfirm(null);
      },
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
          aria-label="Wealth Tracker home"
        >
          <span className="brand-symbol">w.</span>
          <span>
            Wealth
            <br />
            Tracker
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {pages.map((p) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
              aria-current={page === p ? "page" : undefined}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="local-badge">
          <span />
          Local & private
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            className={page === p ? "active" : ""}
          >
            {p === "Data & backup" ? "Backup" : p}
          </button>
        ))}
      </nav>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR MONEY, IN PERSPECTIVE</p>
            <h1>
              {page === "Overview"
                ? "Your wealth. At a glance."
                : page === "Expenses"
                  ? "Know where it goes."
                  : page === "Assets"
                    ? "Everything you own."
                    : page === "Projections"
                      ? "Give your future a number."
                      : "Your data. Your control."}
            </h1>
          </div>
          <div className="heading-actions">
            {data.settings.demo && (
              <span className="demo-badge">
                <Sparkles size={13} /> Example data
              </span>
            )}
            {page === "Overview" && (
              <button
                className="btn"
                onClick={() => openSnapshot()}
                disabled={busy || !storageReady}
              >
                <Plus size={17} />
                Update balances
              </button>
            )}
            {page === "Expenses" && (
              <button
                className="btn secondary"
                disabled={busy || !storageReady}
                onClick={() => setImportOpen(true)}
              >
                <ScanLine size={17} />
                Import screenshot
              </button>
            )}
            {page === "Expenses" && (
              <button
                className="btn"
                onClick={() => openExpense()}
                disabled={busy || !storageReady}
              >
                <Plus size={17} />
                Add monthly cost
              </button>
            )}
            {page === "Assets" && (
              <button
                className="btn"
                onClick={() => setModal({ kind: "account" })}
                disabled={busy || !storageReady}
              >
                <Plus size={17} />
                Add account
              </button>
            )}
          </div>
        </div>
        {error && (
          <div role="alert" className="alert error">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button
              className="icon-btn"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {loading ? (
          <div className="loading">Opening your local workspace…</div>
        ) : (
          <>
            {page === "Overview" && (
              <>
                <div className="overview-grid">
                  <section className="wealth-panel">
                    <div className="section-top">
                      <span className="label">Total recorded assets</span>
                      <span className="muted small">EUR</span>
                    </div>
                    <div className="hero-value">{euro(total)}</div>
                    <div className="balance-sub">
                      {history.length > 1 ? (
                        <>
                          <span
                            className={delta >= 0 ? "positive" : "negative"}
                          >
                            {delta >= 0 ? "+" : ""}
                            {euro(delta)}
                          </span>
                          <span>balance change since first snapshot</span>
                        </>
                      ) : (
                        <span>
                          Add snapshots to see how your assets change.
                        </span>
                      )}
                    </div>
                    {history.length ? (
                      <TrendChart data={filteredHistory} />
                    ) : (
                      <div className="blank-chart">
                        <svg
                          viewBox="0 0 600 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path d="M0 85 L70 75 L130 81 L205 52 L265 60 L340 35 L405 44 L470 18 L530 28 L600 7" />
                        </svg>
                        <span>Your next chapter starts here.</span>
                      </div>
                    )}
                    <div className="chart-bottom">
                      <span className="small muted">
                        {lastUpdate
                          ? `Latest snapshot ${dateLabel(lastUpdate)}`
                          : "No snapshots yet"}
                      </span>
                      <div className="segmented" aria-label="Chart period">
                        {(["6M", "1Y", "ALL"] as const).map((r) => (
                          <button
                            className={range === r ? "selected" : ""}
                            onClick={() => setRange(r)}
                            key={r}
                            aria-pressed={range === r}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="caption">
                      Latest value per account; dates may differ. Balance change
                      includes deposits and withdrawals.
                    </p>
                  </section>
                  <aside className="overview-side">
                    <section className="metric-card">
                      <div className="section-top">
                        <span className="label">Investments</span>
                        <TrendingUp size={18} />
                      </div>
                      <Money value={investments} className="metric-number" />
                      <div className="allocation-bar">
                        <span
                          style={{
                            width: `${total ? (investments / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p className="small muted">
                        {total
                          ? `${Math.round((investments / total) * 100)}% of recorded assets`
                          : "Record your ETF and other investment values"}
                      </p>
                    </section>
                    <section className="metric-card">
                      <div className="section-top">
                        <span className="label">Cash & savings</span>
                        <Wallet size={18} />
                      </div>
                      <Money value={cash} className="metric-number" />
                      <p className="small muted">
                        Across {snapshots.length} recorded account
                        {snapshots.length === 1 ? "" : "s"}
                      </p>
                    </section>
                    <button
                      className="future-card"
                      onClick={() => go("Projections")}
                    >
                      <div>
                        <span className="eyebrow">THINK LONG TERM</span>
                        <h3>
                          Small steps.
                          <br />A bigger future.
                        </h3>
                        <span className="small">
                          Explore your investment plan
                        </span>
                      </div>
                      <ArrowUpRight size={25} />
                    </button>
                  </aside>
                </div>
                <div className="lower-grid">
                  <section className="panel">
                    <div className="section-top">
                      <h2>Your accounts</h2>
                      <button className="text-btn" onClick={() => go("Assets")}>
                        View all
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    {data.accounts.length ? (
                      data.accounts.slice(0, 4).map((a) => {
                        const s = snapshots.find((x) => x.accountId === a.id);
                        return (
                          <button
                            className="account-row clickable"
                            key={a.id}
                            onClick={() => {
                              go("Assets");
                            }}
                          >
                            <span className="account-icon">
                              {accountIcon(a.type)}
                            </span>
                            <span className="grow">
                              <strong>{a.name}</strong>
                              <small>
                                {s
                                  ? `Recorded ${dateLabel(s.date)}`
                                  : "No snapshot yet"}
                              </small>
                            </span>
                            <Money value={s ? s.cash + s.investments : 0} />
                            <ChevronRight size={16} className="muted" />
                          </button>
                        );
                      })
                    ) : (
                      <Empty
                        title="A place for every account"
                        description="Add your brokerage, bank, or savings account to get started."
                        action={
                          <button
                            className="btn secondary"
                            onClick={() => setModal({ kind: "account" })}
                          >
                            Add your first account
                            <Plus size={16} />
                          </button>
                        }
                      />
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-top">
                      <h2>Monthly spending</h2>
                      <input
                        className="month-picker"
                        aria-label="Spending month"
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        min="1900-01"
                        max="2200-12"
                      />
                    </div>
                    <Money value={expenseTotal} className="spending-value" />
                    {categoryTotals.length ? (
                      <>
                        <div className="spend-bar">
                          {categoryTotals.map((c) => (
                            <span
                              key={c.id}
                              style={{
                                width: `${(c.amount / expenseTotal) * 100}%`,
                                background: c.color,
                              }}
                              title={`${c.name}: ${euro(c.amount)}`}
                            />
                          ))}
                        </div>
                        <div className="category-legend">
                          {categoryTotals.slice(0, 4).map((c) => (
                            <span key={c.id}>
                              <i style={{ background: c.color }} />
                              {c.name}
                              <strong>{euro(c.amount)}</strong>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="muted small">
                        No monthly costs recorded for {monthLabel(month)}.
                      </p>
                    )}
                    <button
                      className="text-btn bottom-link"
                      onClick={() => go("Expenses")}
                    >
                      See your spending
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
                <div className="privacy-strip">
                  <ShieldCheck size={18} />
                  <span>
                    Personal by design. Your financial records stay in this
                    browser.
                  </span>
                  <button
                    className="text-btn"
                    onClick={() => go("Data & backup")}
                  >
                    Back up your data
                    <ArrowRight size={15} />
                  </button>
                </div>
                {!data.accounts.length &&
                  !data.monthlyExpenses.length &&
                  !data.payments.length && (
                    <div className="demo-invite">
                      <span>Want to look around first?</span>
                      <button
                        className="text-btn"
                        onClick={showDemo}
                        disabled={busy || !storageReady}
                      >
                        Explore fictional example data
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
              </>
            )}
            {page === "Expenses" && (
              <>
                <div className="toolbar">
                  <div>
                    <h2>Monthly category totals</h2>
                    <p className="muted small">
                      Manual totals or outgoing payment sums, one per category.
                      Manual totals take priority.
                    </p>
                  </div>
                  <input
                    className="month-picker large"
                    type="month"
                    aria-label="Expense month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    min="1900-01"
                    max="2200-12"
                  />
                </div>
                <div className="summary-band">
                  <div>
                    <span className="label">Total for {monthLabel(month)}</span>
                    <Money value={expenseTotal} className="metric-number" />
                  </div>
                  <div>
                    <span className="label">Categories recorded</span>
                    <span className="metric-number">{expenses.length}</span>
                  </div>
                  <div className="summary-note">
                    <CircleHelp size={19} />
                    <p>
                      Monthly costs describe your spending. They don’t
                      automatically change your recorded account balances.
                    </p>
                  </div>
                </div>
                <section className="panel">
                  {expenses.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Note</th>
                            <th className="right">Monthly total</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...expenses]
                            .sort((a, b) => b.amount - a.amount)
                            .map((e, i) => (
                              <tr key={e.id}>
                                <td>
                                  <span className="table-category">
                                    <i
                                      style={{
                                        background: colors[i % colors.length],
                                      }}
                                    />
                                    {
                                      data.categories.find(
                                        (c) => c.id === e.categoryId,
                                      )?.name
                                    }
                                  </span>
                                </td>
                                <td className="muted">
                                  {e.note || "—"}
                                  {e.manual && e.paymentCount > 0 && (
                                    <small className="source-note">
                                      {e.paymentCount} payment(s) excluded from
                                      this total
                                    </small>
                                  )}
                                </td>
                                <td className="right">
                                  <Money value={e.amount} />
                                </td>
                                <td className="row-actions">
                                  {e.manual ? (
                                    <>
                                      <button
                                        className="icon-btn"
                                        onClick={() => openExpense(e.id)}
                                        aria-label={`Edit ${data.categories.find((c) => c.id === e.categoryId)?.name} cost`}
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        className="icon-btn"
                                        onClick={() =>
                                          remove(
                                            "Delete monthly cost?",
                                            "This removes the manual total. Any outgoing payments recorded for this category and month will then determine its total.",
                                            async () => {
                                              await write(
                                                {
                                                  ...data,
                                                  monthlyExpenses:
                                                    data.monthlyExpenses.filter(
                                                      (x) => x.id !== e.id,
                                                    ),
                                                },
                                                "Monthly cost deleted.",
                                              );
                                              setConfirm(null);
                                            },
                                          )
                                        }
                                        aria-label="Delete monthly cost"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="caption">Payment sum</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="A clearer picture of your month"
                      description={`Add your spending totals for ${monthLabel(month)}. Create categories as you go.`}
                      action={
                        <button className="btn" onClick={() => openExpense()}>
                          <Plus size={16} />
                          Add monthly cost
                        </button>
                      }
                    />
                  )}
                </section>
                <PaymentsPanel
                  data={data}
                  month={month}
                  busy={busy}
                  onImport={() => setImportOpen(true)}
                  onEdit={(id) => setModal({ kind: "payment", id })}
                  onDelete={(payment) =>
                    remove(
                      "Delete this payment?",
                      "Payment-based category totals update automatically. Manual totals are unchanged.",
                      async () => {
                        await write(
                          {
                            ...data,
                            payments: data.payments.filter(
                              (p) => p.id !== payment.id,
                            ),
                          },
                          "Payment deleted.",
                        );
                        setConfirm(null);
                      },
                    )
                  }
                />
              </>
            )}
            {page === "Assets" && (
              <>
                <div className="summary-band">
                  <div>
                    <span className="label">Total recorded assets</span>
                    <Money value={total} className="metric-number" />
                  </div>
                  <div>
                    <span className="label">Accounts</span>
                    <span className="metric-number">
                      {data.accounts.length}
                    </span>
                  </div>
                  <div className="summary-note">
                    <CircleHelp size={19} />
                    <p>
                      Enter market values from your account. These are dated
                      records, not live prices.
                    </p>
                  </div>
                </div>
                <div className="account-grid">
                  {data.accounts.map((a) => {
                    const s = snapshots.find((x) => x.accountId === a.id);
                    return (
                      <section className="panel account-card" key={a.id}>
                        <div className="section-top">
                          <span className="account-icon">
                            {accountIcon(a.type)}
                          </span>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              aria-label={`Edit ${a.name}`}
                              onClick={() =>
                                setModal({ kind: "account", id: a.id })
                              }
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Delete ${a.name}`}
                              onClick={() => deleteAccount(a)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <h2>{a.name}</h2>
                        <p className="muted small capitalize">{a.type} · EUR</p>
                        <Money
                          value={s ? s.cash + s.investments : 0}
                          className="metric-number"
                        />
                        <div className="detail-line">
                          <span>Investments</span>
                          <Money value={s?.investments ?? 0} />
                        </div>
                        <div className="detail-line">
                          <span>Cash & savings</span>
                          <Money value={s?.cash ?? 0} />
                        </div>
                        <p className="caption">
                          {s
                            ? `Recorded ${dateLabel(s.date)}`
                            : "No snapshot recorded"}
                        </p>
                        <button
                          className="btn secondary full"
                          onClick={() => openSnapshot(a.id)}
                        >
                          <Plus size={16} />
                          Update balance
                        </button>
                      </section>
                    );
                  })}
                </div>
                {!data.accounts.length && (
                  <section className="panel">
                    <Empty
                      title="Start with your first account"
                      description="You only need an account name and a balance. Never enter your brokerage login or account number."
                      action={
                        <button
                          className="btn"
                          onClick={() => setModal({ kind: "account" })}
                        >
                          <Plus size={16} />
                          Add account
                        </button>
                      }
                    />
                  </section>
                )}
                <section className="panel spaced">
                  <div className="section-top">
                    <h2>Snapshot history</h2>
                    <span className="muted small">
                      {data.assetSnapshots.length} records
                    </span>
                  </div>
                  {data.assetSnapshots.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Account</th>
                            <th className="right">Cash</th>
                            <th className="right">Investments</th>
                            <th className="right">Total</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.assetSnapshots]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((s) => (
                              <tr key={s.id}>
                                <td>{dateLabel(s.date)}</td>
                                <td>
                                  {
                                    data.accounts.find(
                                      (a) => a.id === s.accountId,
                                    )?.name
                                  }
                                </td>
                                <td className="right">
                                  <Money value={s.cash} />
                                </td>
                                <td className="right">
                                  <Money value={s.investments} />
                                </td>
                                <td className="right">
                                  <Money value={s.cash + s.investments} />
                                </td>
                                <td className="row-actions">
                                  <button
                                    className="icon-btn"
                                    onClick={() =>
                                      openSnapshot(s.accountId, s.id)
                                    }
                                    aria-label="Edit snapshot"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    onClick={() => deleteSnapshot(s.id)}
                                    aria-label="Delete snapshot"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">
                      Your dated balance updates will appear here.
                    </p>
                  )}
                </section>
                <section className="panel spaced">
                  <div className="section-top">
                    <div>
                      <h2>Contributions & withdrawals</h2>
                      <p className="small muted">
                        Cash-flow records don’t change snapshots automatically.
                      </p>
                    </div>
                    <button
                      className="btn secondary"
                      disabled={!data.accounts.length}
                      onClick={() => setModal({ kind: "flow" })}
                    >
                      <Plus size={16} />
                      Add cash flow
                    </button>
                  </div>
                  {data.cashFlows.length ? (
                    <div className="flow-list">
                      {[...data.cashFlows]
                        .filter((f) => f.kind !== "transfer-in")
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((f) => (
                          <div className="account-row" key={f.id}>
                            <span className="account-icon">
                              {f.kind === "contribution" ? (
                                <ArrowDownLeft size={18} />
                              ) : f.kind === "withdrawal" ? (
                                <ArrowUpRight size={18} />
                              ) : (
                                <ArrowLeftRight size={18} />
                              )}
                            </span>
                            <span className="grow">
                              <strong>
                                {f.kind === "transfer-out"
                                  ? "Internal transfer"
                                  : f.kind === "contribution"
                                    ? "Contribution"
                                    : "Withdrawal"}
                              </strong>
                              <small>
                                {
                                  data.accounts.find(
                                    (a) => a.id === f.accountId,
                                  )?.name
                                }
                                {f.pairId
                                  ? ` → ${data.accounts.find((a) => a.id === data.cashFlows.find((x) => x.pairId === f.pairId && x.kind === "transfer-in")?.accountId)?.name}`
                                  : ""}{" "}
                                · {dateLabel(f.date)}
                              </small>
                            </span>
                            <Money value={f.amount} />
                            <button
                              className="icon-btn"
                              aria-label="Delete cash flow"
                              onClick={() =>
                                remove(
                                  "Delete cash-flow record?",
                                  "For an internal transfer, both sides will be removed.",
                                  async () => {
                                    await write(
                                      {
                                        ...data,
                                        cashFlows: data.cashFlows.filter((x) =>
                                          f.pairId
                                            ? x.pairId !== f.pairId
                                            : x.id !== f.id,
                                        ),
                                      },
                                      "Cash-flow record deleted.",
                                    );
                                    setConfirm(null);
                                  },
                                )
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="muted">
                      Record money you add or withdraw to keep it separate from
                      investment growth.
                    </p>
                  )}
                </section>
              </>
            )}
            {page === "Projections" && (
              <>
                <div className="projection-layout">
                  <section className="panel projection-inputs">
                    <div className="section-top">
                      <h2>Your assumptions</h2>
                      <TrendingUp size={19} />
                    </div>
                    <p className="small muted">
                      Explore a possibility. This is not a forecast.
                    </p>
                    <Field label="Saved scenario">
                      <select
                        value={selectedScenario}
                        onChange={(e) => {
                          setSelectedScenario(e.target.value);
                          const s = data.scenarios.find(
                            (s) => s.id === e.target.value,
                          );
                          if (s) setScenario(s);
                          else
                            setScenario({
                              ...scenario,
                              id: "",
                              name: "My projection",
                            });
                        }}
                      >
                        <option value="">Unsaved scenario</option>
                        {data.scenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Scenario name">
                      <input
                        value={scenario.name}
                        maxLength={80}
                        onChange={(e) =>
                          setScenario({ ...scenario, name: e.target.value })
                        }
                      />
                    </Field>
                    <div className="field">
                      <span>Starting amount (€)</span>
                      <input
                        aria-label="Starting amount in euros"
                        type="number"
                        min="0"
                        max="1000000000"
                        step="0.01"
                        value={scenario.initial / 100}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            initial: Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                      <button
                        className="text-btn small"
                        onClick={() =>
                          setScenario({ ...scenario, initial: investments })
                        }
                      >
                        Use recorded investments ({euro(investments)})
                      </button>
                    </div>
                    <Field label="Monthly contribution (€)">
                      <input
                        type="number"
                        min="0"
                        max="1000000000"
                        step="0.01"
                        value={scenario.monthly / 100}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            monthly: Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Annual return (%)">
                        <input
                          type="number"
                          min="-99.9"
                          max="100"
                          step="0.1"
                          value={Number((scenario.annualRate * 100).toFixed(3))}
                          onChange={(e) =>
                            setScenario({
                              ...scenario,
                              annualRate: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </Field>
                      <Field label="Inflation (%)">
                        <input
                          type="number"
                          min="-99.9"
                          max="100"
                          step="0.1"
                          value={Number((scenario.inflation * 100).toFixed(3))}
                          onChange={(e) =>
                            setScenario({
                              ...scenario,
                              inflation: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field
                      label={`Investment horizon · ${scenario.years} years`}
                    >
                      <input
                        type="range"
                        min="1"
                        max="60"
                        value={scenario.years}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            years: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <button
                      className="btn full"
                      disabled={
                        busy || !!scenarioError || !scenario.name.trim()
                      }
                      onClick={() =>
                        attempt(async () => {
                          const record = {
                            ...scenario,
                            id: scenario.id || uid(),
                            name: scenario.name.trim(),
                          };
                          await write(
                            {
                              ...data,
                              scenarios: data.scenarios
                                .filter((s) => s.id !== record.id)
                                .concat(record),
                            },
                            "Scenario saved.",
                          );
                          setScenario(record);
                          setSelectedScenario(record.id);
                        })
                      }
                    >
                      Save scenario
                      <Check size={16} />
                    </button>
                    {scenario.id && (
                      <button
                        className="text-btn danger-text"
                        onClick={() =>
                          remove(
                            "Delete saved scenario?",
                            "Your recorded assets and expenses will be kept.",
                            async () => {
                              await write(
                                {
                                  ...data,
                                  scenarios: data.scenarios.filter(
                                    (s) => s.id !== scenario.id,
                                  ),
                                },
                                "Scenario deleted.",
                              );
                              setScenario({ ...scenario, id: "" });
                              setSelectedScenario("");
                              setConfirm(null);
                            },
                          )
                        }
                      >
                        Delete saved scenario
                      </button>
                    )}
                  </section>
                  <div>
                    <section className="panel projection-output">
                      <p className="eyebrow">POSSIBLE FUTURE VALUE</p>
                      <h2 className="projection-value">
                        {result ? euro(result.balance * 100) : "—"}
                      </h2>
                      <p className="muted">
                        After {scenario.years} years at your assumed rate
                      </p>
                      {scenarioError ? (
                        <div role="alert" className="alert error">
                          {scenarioError}
                        </div>
                      ) : (
                        <>
                          <div
                            className="projection-chart"
                            role="img"
                            aria-label="Hypothetical investment value, contributions, and inflation-adjusted value"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={points}
                                margin={{
                                  top: 20,
                                  right: 10,
                                  left: 0,
                                  bottom: 0,
                                }}
                              >
                                <CartesianGrid
                                  vertical={false}
                                  stroke="#ededed"
                                />
                                <XAxis
                                  dataKey="year"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: "#888", fontSize: 11 }}
                                  tickFormatter={(v) => `${v}y`}
                                />
                                <YAxis
                                  tickFormatter={compactEuro}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: "#888", fontSize: 11 }}
                                  width={55}
                                />
                                <Tooltip content={<ChartTip />} />
                                <Line
                                  isAnimationActive={false}
                                  dataKey="balance"
                                  name="Projected value"
                                  stroke="#789953"
                                  strokeWidth={3}
                                  dot={false}
                                />
                                <Line
                                  isAnimationActive={false}
                                  dataKey="contributions"
                                  name="Contributions"
                                  stroke="#b2b2b2"
                                  strokeWidth={2}
                                  strokeDasharray="4 4"
                                  dot={false}
                                />
                                <Line
                                  isAnimationActive={false}
                                  dataKey="real"
                                  name="Today's purchasing power"
                                  stroke="#161616"
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="projection-legend">
                            <span>
                              <i style={{ background: "#789953" }} />
                              Projected value
                            </span>
                            <span>
                              <i style={{ background: "#b2b2b2" }} />
                              Contributions
                            </span>
                            <span>
                              <i style={{ background: "#161616" }} />
                              Today's purchasing power
                            </span>
                          </div>
                          <div className="projection-totals">
                            <div>
                              <span className="label">Your contributions</span>
                              <strong>
                                {euro((result?.contributions ?? 0) * 100)}
                              </strong>
                            </div>
                            <div>
                              <span className="label">Hypothetical growth</span>
                              <strong>
                                {euro(
                                  ((result?.balance ?? 0) -
                                    (result?.contributions ?? 0)) *
                                    100,
                                )}
                              </strong>
                            </div>
                            <div>
                              <span className="label">In today's euros</span>
                              <strong>{euro((result?.real ?? 0) * 100)}</strong>
                            </div>
                          </div>
                        </>
                      )}
                    </section>
                    <div className="info-box">
                      <CircleHelp size={19} />
                      <div>
                        <strong>Assumptions, not promises.</strong>
                        <p>
                          Returns compound monthly using an effective annual
                          rate. Contributions are added at month end. Taxes and
                          fees are excluded; actual returns vary and losses are
                          possible. This constant-rate scenario is not a
                          simulated range of outcomes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {page === "Data & backup" && (
              <>
                <section className="data-intro">
                  <div className="data-icon">
                    <HardDrive size={30} />
                  </div>
                  <div>
                    <h2>Stored here. Controlled by you.</h2>
                    <p>
                      Your records live in this browser’s database, not on
                      GitHub or Sites. No account login or brokerage connection
                      is needed.
                    </p>
                  </div>
                  <span className="local-badge">
                    <span />
                    Browser storage
                  </span>
                </section>
                <div className="backup-grid">
                  <section className="panel backup-card">
                    <span className="account-icon">
                      <Download size={23} />
                    </span>
                    <h2>Export a backup</h2>
                    <p>
                      Download all expenses, payments, accounts, snapshots, cash
                      flows, and scenarios in one JSON file.
                    </p>
                    <div className="backup-status">
                      <span className="label">Last export initiated</span>
                      <strong>
                        {data.settings.lastExportAt
                          ? new Date(data.settings.lastExportAt).toLocaleString(
                              "en-GB",
                            )
                          : "No backup exported yet"}
                      </strong>
                    </div>
                    <button
                      className="btn full"
                      disabled={busy || !storageReady}
                      onClick={() => attempt(exportBackup)}
                    >
                      <Download size={17} />
                      Export backup
                    </button>
                    <small>
                      Keep the file privately, outside your GitHub folder. JSON
                      files are readable text and are not encrypted.
                    </small>
                  </section>
                  <section className="panel backup-card">
                    <span className="account-icon">
                      <Upload size={23} />
                    </span>
                    <h2>Restore your records</h2>
                    <p>
                      Recover after data loss or move to a new browser. Select a
                      Wealth Tracker JSON backup to review it first.
                    </p>
                    <div className="restore-steps">
                      <span>
                        <b>1</b>Select your file
                      </span>
                      <span>
                        <b>2</b>Review its contents
                      </span>
                      <span>
                        <b>3</b>Confirm replacement
                      </span>
                    </div>
                    <button
                      className="btn secondary full"
                      disabled={busy || !storageReady}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={17} />
                      Choose backup file
                    </button>
                    <small>
                      Nothing changes until you confirm. Restore replaces
                      existing records; it does not merge them.
                    </small>
                  </section>
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileRef}
                  className="sr-only"
                  aria-label="Select JSON backup"
                  onChange={(e) => {
                    void loadFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <section className="panel spaced">
                  <div className="section-top">
                    <h2>What’s in this browser</h2>
                    <Database size={19} />
                  </div>
                  <div className="record-counts">
                    {[
                      ["Accounts", data.accounts.length],
                      ["Categories", data.categories.length],
                      ["Monthly costs", data.monthlyExpenses.length],
                      ["Payments", data.payments.length],
                      ["Snapshots", data.assetSnapshots.length],
                      ["Cash flows", data.cashFlows.length],
                      ["Scenarios", data.scenarios.length],
                    ].map(([name, count]) => (
                      <div key={name}>
                        <strong>{count}</strong>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="info-box">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>A little backup habit goes a long way.</strong>
                    <p>
                      Export after each monthly update. Clearing website data or
                      deleting a browser profile can erase records. Another
                      browser or device has its own database. Private browsing
                      is unsuitable for keeping records. A backup recovers only
                      the state at export, not later edits. If the Site is
                      unavailable, run or redeploy the app and restore there.
                    </p>
                  </div>
                </div>
                <section className="panel spaced utilities">
                  <div>
                    <h3>Explore fictional data</h3>
                    <p className="small muted">
                      Try a filled dashboard. This replaces current records
                      after confirmation.
                    </p>
                  </div>
                  <button
                    className="btn secondary"
                    onClick={showDemo}
                    disabled={busy || !storageReady}
                  >
                    <Sparkles size={16} />
                    Load examples
                  </button>
                </section>
                <section className="panel spaced utilities">
                  <div>
                    <h3>Clear this browser’s records</h3>
                    <p className="small muted">
                      Export a backup first. Deletion cannot be undone without a
                      backup.
                    </p>
                  </div>
                  <button
                    className="btn danger-outline"
                    disabled={busy || !storageReady}
                    onClick={() =>
                      setConfirm({
                        title: "Erase all local records?",
                        description:
                          "All records in this browser will be deleted. Export a backup before continuing if you want to recover them.",
                        label: "Erase all records",
                        danger: true,
                        action: async () => {
                          await write(emptyData(), "All local records erased.");
                          setConfirm(null);
                          setScenario({ ...scenario, id: "" });
                          setSelectedScenario("");
                        },
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Clear all records
                  </button>
                </section>
              </>
            )}
          </>
        )}
        <footer>
          <span>
            Wealth Tracker <span className="footer-dot">·</span> A little
            clarity, every month.
          </span>
          <span>Independent project. Not affiliated with Trade Republic.</span>
        </footer>
      </main>
      {importOpen && (
        <PaymentImport
          data={data}
          busy={busy}
          onClose={() => setImportOpen(false)}
          onSave={async (next) => {
            await write(next, "Selected payments imported.");
            const oldIds = new Set(data.payments.map((p) => p.id));
            const last = next.payments
              .filter((p) => !oldIds.has(p.id))
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            if (last) setMonth(last.date.slice(0, 7));
          }}
        />
      )}
      {modal && (
        <ModalFrame
          title={
            modal.kind === "expense"
              ? modal.id
                ? "Edit monthly cost"
                : "Add monthly cost"
              : modal.kind === "account"
                ? modal.id
                  ? "Edit account"
                  : "Add an account"
                : modal.kind === "snapshot"
                  ? modal.id
                    ? "Edit snapshot"
                    : "Update balance"
                  : modal.kind === "payment"
                    ? "Edit payment"
                    : "Record a cash flow"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={saveForm}>
            {modal.kind === "expense" && (
              <>
                <p className="modal-copy">
                  Enter the total for one category. Editing this entry replaces
                  its previous amount. A manual total overrides any recorded
                  payments in that category and month.
                </p>
                <Field label="Month">
                  <input
                    name="month"
                    type="month"
                    defaultValue={editingExpense?.month ?? month}
                    min="1900-01"
                    max="2200-12"
                    required
                  />
                </Field>
                <Field label="Category">
                  <select
                    name="category"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  >
                    {data.categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="new">+ Create a category</option>
                  </select>
                </Field>
                {expenseCategory === "new" && (
                  <Field label="New category name">
                    <input
                      name="categoryName"
                      placeholder="e.g. Groceries"
                      maxLength={60}
                      required
                    />
                  </Field>
                )}
                <Field label="Monthly total (€)" hint="German format: 1.250,50">
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={
                      editingExpense ? moneyText(editingExpense.amount) : ""
                    }
                    required
                  />
                </Field>
                <Field label="Note (optional)">
                  <input
                    name="note"
                    maxLength={500}
                    defaultValue={editingExpense?.note ?? ""}
                    placeholder="Anything worth remembering"
                  />
                </Field>
              </>
            )}
            {modal.kind === "payment" && editingPayment && (
              <>
                <p className="modal-copy">
                  Outgoing payments count toward category totals only when no
                  manual total exists for that category and month.
                </p>
                <Field label="Payment date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={editingPayment.date}
                    min="1900-01-01"
                    max={today()}
                    required
                  />
                </Field>
                <Field label="Description">
                  <input
                    name="description"
                    defaultValue={editingPayment.description}
                    maxLength={250}
                    required
                  />
                </Field>
                <Field label="Amount (€)" hint="German format: 1.250,50">
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={moneyText(editingPayment.amount)}
                    required
                  />
                </Field>
                <Field label="Direction">
                  <select
                    name="direction"
                    defaultValue={editingPayment.direction}
                  >
                    <option value="debit">Outgoing</option>
                    <option value="credit">Incoming</option>
                  </select>
                </Field>
                <Field label="Payment category">
                  <select
                    name="category"
                    defaultValue={editingPayment.categoryId}
                  >
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {modal.kind === "account" && (
              <>
                <p className="modal-copy">
                  A nickname is enough. Don’t enter account numbers, PINs, or
                  login details.
                </p>
                <Field label="Account name">
                  <input
                    name="name"
                    defaultValue={editingAccount?.name ?? ""}
                    maxLength={80}
                    placeholder="e.g. My brokerage"
                    required
                  />
                </Field>
                <Field label="Account type">
                  <select
                    name="type"
                    defaultValue={editingAccount?.type ?? "brokerage"}
                  >
                    <option value="brokerage">Brokerage / investments</option>
                    <option value="bank">Bank account</option>
                    <option value="savings">Savings</option>
                  </select>
                </Field>
                <p className="caption">
                  Currency: EUR. Add a balance snapshot after creating the
                  account.
                </p>
              </>
            )}
            {modal.kind === "snapshot" && (
              <>
                <p className="modal-copy">
                  Copy the current cash and investment market value from your
                  account. Previous snapshot dates are kept.
                </p>
                <Field label="Account">
                  <select
                    name="accountId"
                    defaultValue={
                      editingSnapshot?.accountId ??
                      modal.accountId ??
                      data.accounts[0]?.id
                    }
                  >
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Valuation date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={editingSnapshot?.date ?? today()}
                    min="1900-01-01"
                    max={today()}
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Cash / savings (€)">
                    <input
                      name="cash"
                      inputMode="decimal"
                      defaultValue={
                        editingSnapshot
                          ? moneyText(editingSnapshot.cash)
                          : "0,00"
                      }
                      required
                    />
                  </Field>
                  <Field label="Investments (€)">
                    <input
                      name="investments"
                      inputMode="decimal"
                      defaultValue={
                        editingSnapshot
                          ? moneyText(editingSnapshot.investments)
                          : "0,00"
                      }
                      required
                    />
                  </Field>
                </div>
                <p className="caption">
                  Use comma decimals (1.250,50). Don’t enter the account total
                  again as cash.
                </p>
              </>
            )}
            {modal.kind === "flow" && (
              <>
                <p className="modal-copy">
                  Record money moving into or out of an account. This does not
                  automatically change its balance snapshot.
                </p>
                <Field label="Type">
                  <select
                    name="kind"
                    onChange={(e) => {
                      const field = e.currentTarget.form?.elements.namedItem(
                        "destination",
                      ) as HTMLSelectElement | null;
                      if (field) field.disabled = e.target.value !== "transfer";
                    }}
                  >
                    <option value="contribution">
                      Contribution from outside tracked accounts
                    </option>
                    <option value="withdrawal">
                      Withdrawal from tracked accounts
                    </option>
                    {data.accounts.length > 1 && (
                      <option value="transfer">
                        Transfer between tracked accounts
                      </option>
                    )}
                  </select>
                </Field>
                <Field label="Account / source">
                  <select name="accountId">
                    {data.accounts.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {data.accounts.length > 1 && (
                  <Field label="Destination (internal transfers only)">
                    <select
                      name="destination"
                      disabled
                      defaultValue={data.accounts[1]?.id}
                    >
                      {data.accounts.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={today()}
                    min="1900-01-01"
                    max={today()}
                    required
                  />
                </Field>
                <Field label="Amount (€)" hint="German format: 1.250,50">
                  <input
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                  />
                </Field>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {submitButtons}
          </form>
        </ModalFrame>
      )}
      {confirm && (
        <ModalFrame
          title={confirm.title}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p className="modal-copy">{confirm.description}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className={`btn ${confirm.danger ? "danger" : ""}`}
              disabled={busy}
              onClick={() => attempt(confirm.action)}
            >
              {busy ? "Saving…" : confirm.label}
            </button>
          </div>
        </ModalFrame>
      )}
      {backup && (
        <ModalFrame
          title="Review your backup"
          onClose={() => {
            if (!busy) setBackup(null);
          }}
        >
          <p className="modal-copy">
            Exported {new Date(backup.exportedAt).toLocaleString("en-GB")}. This
            file has passed format and record validation.
          </p>
          <div className="restore-counts">
            {[
              ["Accounts", backup.data.accounts.length],
              ["Categories", backup.data.categories.length],
              ["Monthly costs", backup.data.monthlyExpenses.length],
              ["Payments", backup.data.payments.length],
              ["Snapshots", backup.data.assetSnapshots.length],
              ["Cash flows", backup.data.cashFlows.length],
              ["Scenarios", backup.data.scenarios.length],
            ].map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="alert warning">
            <AlertTriangle size={20} />
            <span>
              Restore replaces all current records in this browser. It does not
              merge them. Changes after this export will not be recovered.
            </span>
          </div>
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => attempt(exportBackup)}
          >
            <Download size={15} />
            Export current records first
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setBackup(null)}
            >
              Cancel
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                attempt(async () => {
                  const next = structuredClone(backup.data);
                  delete next.settings.lastExportAt;
                  await write(next, "Backup restored successfully.");
                  setBackup(null);
                  setSelectedScenario("");
                  setScenario({
                    id: "",
                    name: "My projection",
                    initial: 0,
                    monthly: 20000,
                    annualRate: 0.05,
                    years: 20,
                    inflation: 0.02,
                  });
                })
              }
            >
              {busy ? "Restoring…" : "Replace & restore"}
              <Upload size={16} />
            </button>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
