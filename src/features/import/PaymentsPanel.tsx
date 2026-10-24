import { Pencil, Trash2, ScanLine } from "lucide-react";
import { type Data, type Payment, euro } from "../../domain/model";
export default function PaymentsPanel({
  data,
  month,
  busy,
  onImport,
  onEdit,
  onDelete,
}: {
  data: Data;
  month: string;
  busy: boolean;
  onImport: () => void;
  onEdit: (id: string) => void;
  onDelete: (p: Payment) => void;
}) {
  const payments = data.payments
    .filter((p) => p.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel spaced" id="recorded-payments">
      <div className="section-top">
        <div>
          <h2>Recorded payments</h2>
          <p className="small muted">
            {payments.length} records this month · incoming money is excluded
            from spending.
          </p>
        </div>
        <button className="btn secondary" disabled={busy} onClick={onImport}>
          <ScanLine size={16} />
          Import screenshot
        </button>
      </div>
      {payments.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Spending treatment</th>
                <th className="right">Amount</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const manual = data.monthlyExpenses.some(
                  (e) => e.month === month && e.categoryId === p.categoryId,
                );
                return (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td>{p.description}</td>
                    <td>
                      {data.categories.find((c) => c.id === p.categoryId)?.name}
                    </td>
                    <td className="muted small">
                      {p.direction === "credit"
                        ? "Incoming · excluded"
                        : manual
                          ? "Manual total takes priority"
                          : "Included in category total"}
                    </td>
                    <td className="right">
                      {p.direction === "credit" ? "+" : "−"}
                      {euro(p.amount, 2)}
                    </td>
                    <td className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={`Edit payment ${p.description}`}
                        onClick={() => onEdit(p.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Delete payment ${p.description}`}
                        onClick={() => onDelete(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted small">
          Import a list of payments to review and save them in one batch. A
          manual category total always takes priority over payment sums.
        </p>
      )}
    </section>
  );
}
