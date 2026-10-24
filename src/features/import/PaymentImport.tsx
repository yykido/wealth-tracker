import { useEffect, useRef, useState } from "react";
import {
  Upload,
  X,
  Plus,
  ShieldCheck,
  ScanLine,
  Check,
  AlertTriangle,
} from "lucide-react";
import { type Data, euro, today } from "../../domain/model";
import { parseScreenshotText } from "../../domain/screenshot";
import {
  type ReviewRow,
  type ConflictChoice,
  duplicateIds,
  rowProblems,
  importConflicts,
  applyPaymentImport,
} from "../../domain/payments";
import { recognizeScreenshot, type ScanProgress } from "./ocr";
type Props = {
  data: Data;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Data) => Promise<void>;
};
export default function PaymentImport({ data, busy, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    controller = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]),
    [text, setText] = useState(""),
    [year, setYear] = useState(Number(today().slice(0, 4)));
  const [language, setLanguage] = useState<"eng" | "deu" | "eng+deu">(
    "eng+deu",
  );
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  const [scanning, setScanning] = useState(false),
    [progress, setProgress] = useState<ScanProgress>({
      status: "Preparing scan",
      progress: 0,
    });
  const [error, setError] = useState(""),
    [unmatched, setUnmatched] = useState<string[]>([]),
    [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const [needsReparse, setNeedsReparse] = useState(false);
  const [mode, setMode] = useState<"image" | "text">("image");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => {
      controller.current?.abort();
      node?.close();
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const close = () => {
    if (!busy) {
      controller.current?.abort();
      onClose();
    }
  };
  const update = (id: string, change: Partial<ReviewRow>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...change } : r)),
    );
  const parse = (value: string) => {
    const result = parseScreenshotText(value, year);

    // Imported duplicates are unchecked by default; the review still allows explicit exceptions.
    const flagged = duplicateIds(result.rows, data);
    setRows(
      result.rows.map((r) => ({
        ...r,
        selected: r.selected && !flagged.has(r.id),
      })),
    );
    setUnmatched(result.unmatched);
    setChoices({});
    setNeedsReparse(false);
    if (!result.rows.length)
      setError(
        "No payment rows recognized. Try a clearer crop, edit the extracted text, or add rows manually.",
      );
    else setError("");
  };
  const scan = async () => {
    if (!file) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setScanning(true);
    setError("");
    try {
      const result = await recognizeScreenshot(
        file,
        language,
        current.signal,
        setProgress,
      );
      if (!current.signal.aborted) {
        setText(result);
        parse(result);
      }
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : "Unable to scan this image.");
    } finally {
      if (controller.current === current) setScanning(false);
    }
  };
  const duplicates = duplicateIds(rows, data),
    selected = rows.filter((r) => r.selected),
    conflicts = importConflicts(rows, data);
  const problems = selected.flatMap(rowProblems),
    unconfirmed = selected.some(
      (r) => duplicates.has(r.id) && !r.allowDuplicate,
    );
  const canImport =
    selected.length > 0 &&
    !problems.length &&
    !unconfirmed &&
    conflicts.every((c) => !!choices[c.key]) &&
    !busy &&
    !scanning &&
    !needsReparse;
  const commit = async () => {
    setError("");
    try {
      await onSave(applyPaymentImport(data, rows, choices));
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import failed. No payments were saved.",
      );
    }
  };
  return (
    <dialog
      className="import-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label="Import payments"
    >
      <div className="import-shell">
        <div className="modal-title">
          <div>
            <p className="eyebrow">SCREENSHOT TO SPENDING</p>
            <h2>Import a list of payments</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close import"
            disabled={busy}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <p className="modal-copy">
          Scan a clear payment list, review every row, then save in one batch.
          Images and extracted text stay in memory and are not stored or
          uploaded.
        </p>
        <details
          className="import-source-details"
          open={!rows.length || needsReparse}
        >
          <summary>Source image, language & extracted text</summary>
          <div className="import-top">
            <section className="scan-controls">
              <div className="segmented import-mode">
                <button
                  className={mode === "image" ? "selected" : ""}
                  disabled={scanning}
                  onClick={() => setMode("image")}
                >
                  Screenshot / photo
                </button>
                <button
                  className={mode === "text" ? "selected" : ""}
                  disabled={scanning}
                  onClick={() => setMode("text")}
                >
                  Paste a payment list
                </button>
              </div>
              {mode === "image" && (
                <>
                  <label className="image-picker">
                    <Upload size={22} />
                    <strong>
                      {file ? file.name : "Choose a screenshot or photo"}
                    </strong>
                    <span>PNG, JPEG, WebP · up to 10 MB</span>
                    <input
                      aria-label="Payment screenshot"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={scanning || busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setFile(f);
                          setError("");
                          setRows([]);
                          setText("");
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Recognition language</span>
                    <select
                      value={language}
                      disabled={scanning}
                      onChange={(e) =>
                        setLanguage(e.target.value as typeof language)
                      }
                    >
                      <option value="eng+deu">English + German</option>
                      <option value="eng">English</option>
                      <option value="deu">German</option>
                    </select>
                  </label>
                </>
              )}
              <label className="field">
                <span>Year for dates without a year</span>
                <input
                  type="number"
                  min="1900"
                  max="2200"
                  value={year}
                  disabled={scanning}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    if (rows.length) setNeedsReparse(true);
                  }}
                />
                <small>
                  Check this against the screenshot, especially around New Year.
                </small>
              </label>
              {mode === "image" && (
                <button
                  className="btn full"
                  disabled={!file || scanning || busy}
                  onClick={scan}
                >
                  <ScanLine size={17} />
                  {scanning ? "Scanning…" : "Scan payment list"}
                </button>
              )}
              {scanning && (
                <div className="scan-progress" role="status">
                  <progress
                    aria-label="Scan progress"
                    max="1"
                    value={progress.progress}
                  />
                  <p>
                    {progress.status.replaceAll("_", " ")} ·{" "}
                    {Math.round(progress.progress * 100)}%
                  </p>
                  <button
                    className="text-btn"
                    onClick={() => controller.current?.abort()}
                  >
                    Cancel scan
                  </button>
                </div>
              )}
              <div className="scan-privacy">
                <ShieldCheck size={17} />
                <span>
                  Recognition runs on this device. OCR files are downloaded from
                  this website only.
                </span>
              </div>
            </section>
            <section className="scan-source">
              {mode === "image" && preview && (
                <details>
                  <summary>View selected image</summary>
                  <img src={preview} alt="Selected payment list, not saved" />
                </details>
              )}
              {(mode === "text" || text) && (
                <details open={mode === "text" || rows.length === 0}>
                  <summary>
                    {mode === "text"
                      ? "Payment list text"
                      : "Extracted text — correct or reparse"}
                  </summary>
                  <p className="caption">
                    Supported: a date, merchant and signed amount per row, e.g.
                    20.10.2026 REWE -42,80 €. Date headings followed by payments
                    are also supported. Use explicit signs; unsigned amounts
                    need a direction in review.
                  </p>
                  <textarea
                    aria-label="Payment list text"
                    value={text}
                    maxLength={60000}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (rows.length) setNeedsReparse(true);
                    }}
                    placeholder={
                      "20.10.2026 REWE -42,80 €\n21.10.2026 DB ticket -29,90 €\n22.10.2026 Restaurant -35,00 €"
                    }
                  />
                  <button
                    className="btn secondary"
                    disabled={scanning || busy || !text.trim()}
                    onClick={() => {
                      try {
                        parse(text);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Build review table
                    <ArrowIcon />
                  </button>
                </details>
              )}
              {!text && !preview && (
                <div className="scan-tips">
                  <ScanLine size={30} />
                  <h3>A list, not just one receipt.</h3>
                  <p>
                    Use a clear crop showing dates, merchants and amounts. Dark
                    text on a light background works best. Deselect transfers,
                    investment purchases and other non-spending entries.
                  </p>
                  <p>
                    OCR may misread values. No records change until you confirm
                    the review.
                  </p>
                </div>
              )}
              {unmatched.length > 0 && (
                <p className="caption">
                  {unmatched.length} source lines were not treated as payment
                  rows. Check the extracted text for missed items.
                </p>
              )}
            </section>
          </div>
        </details>
        {error && (
          <div role="alert" className="alert error">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
        {needsReparse && rows.length > 0 && (
          <div className="alert warning">
            <span>
              Source text or the inferred year changed. Rebuild the review table
              before importing; this replaces current review edits.
            </span>
            <button
              className="text-btn"
              disabled={scanning || busy}
              onClick={() => {
                try {
                  parse(text);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Rebuild review
            </button>
          </div>
        )}
        {rows.length > 0 && (
          <section className="import-review">
            <div className="section-top">
              <div>
                <h3>
                  Review {rows.length} payment{rows.length === 1 ? "" : "s"}
                </h3>
                <p className="small muted">
                  Categories are suggestions. Incoming money is excluded from
                  spending totals.
                </p>
              </div>
              <button
                className="btn secondary"
                disabled={scanning || busy || rows.length >= 500}
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      selected: true,
                      date: "",
                      description: "",
                      amount: "",
                      direction: "unknown",
                      category: "Other",
                      allowDuplicate: false,
                      note: "Added manually; complete all fields.",
                    },
                  ])
                }
              >
                <Plus size={15} />
                Add row
              </button>
            </div>
            <div className="review-toolbar">
              <button
                className="text-btn"
                onClick={() =>
                  setRows((current) =>
                    current.map((r) => ({
                      ...r,
                      selected:
                        r.direction === "debit" && !duplicates.has(r.id),
                    })),
                  )
                }
              >
                Select outgoing, non-duplicate rows
              </button>
              <button
                className="text-btn"
                onClick={() =>
                  setRows((current) =>
                    current.map((r) => ({ ...r, selected: false })),
                  )
                }
              >
                Deselect all
              </button>
              <span>{selected.length} selected</span>
            </div>
            <datalist id="import-categories">
              {[
                ...new Set([
                  ...data.categories.map((c) => c.name),
                  "Groceries",
                  "Transport",
                  "Dining",
                  "Housing",
                  "Leisure",
                  "Other",
                ]),
              ].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="table-wrap review-table">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount (€)</th>
                    <th>Direction</th>
                    <th>Category</th>
                    <th>Review notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const issues = rowProblems(row);
                    const duplicate = duplicates.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={row.selected ? "" : "unselected"}
                      >
                        <td data-label="Include payment">
                          <input
                            type="checkbox"
                            aria-label={`Select payment ${index + 1}`}
                            checked={row.selected}
                            onChange={(e) =>
                              update(row.id, { selected: e.target.checked })
                            }
                          />
                        </td>
                        <td data-label="Date">
                          <input
                            type="date"
                            aria-label={`Date ${index + 1}`}
                            min="1900-01-01"
                            max={today()}
                            value={row.date}
                            onChange={(e) =>
                              update(row.id, { date: e.target.value })
                            }
                          />
                        </td>
                        <td data-label="Description">
                          <input
                            aria-label={`Description ${index + 1}`}
                            value={row.description}
                            maxLength={250}
                            onChange={(e) =>
                              update(row.id, { description: e.target.value })
                            }
                          />
                        </td>
                        <td data-label="Amount (€)">
                          <input
                            aria-label={`Amount ${index + 1}`}
                            inputMode="decimal"
                            value={row.amount}
                            onChange={(e) =>
                              update(row.id, { amount: e.target.value })
                            }
                          />
                        </td>
                        <td data-label="Direction">
                          <select
                            aria-label={`Direction ${index + 1}`}
                            value={row.direction}
                            onChange={(e) =>
                              update(row.id, {
                                direction: e.target
                                  .value as ReviewRow["direction"],
                              })
                            }
                          >
                            <option value="unknown">Choose…</option>
                            <option value="debit">Outgoing</option>
                            <option value="credit">Incoming</option>
                          </select>
                        </td>
                        <td data-label="Category">
                          <input
                            aria-label={`Category ${index + 1}`}
                            value={row.category}
                            maxLength={60}
                            list="import-categories"
                            onChange={(e) =>
                              update(row.id, { category: e.target.value })
                            }
                          />
                        </td>
                        <td data-label="Review notes">
                          <span className="review-note">{row.note}</span>
                          {row.selected &&
                            issues.map((issue) => (
                              <span className="review-problem" key={issue}>
                                {issue}
                              </span>
                            ))}
                          {duplicate && (
                            <label className="duplicate-check">
                              <strong>Possible duplicate</strong>
                              <span>
                                <input
                                  type="checkbox"
                                  aria-label={`Confirm duplicate ${index + 1}`}
                                  checked={row.allowDuplicate}
                                  onChange={(e) =>
                                    update(row.id, {
                                      allowDuplicate: e.target.checked,
                                    })
                                  }
                                />
                                This is a separate payment
                              </span>
                            </label>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {conflicts.length > 0 && (
              <div className="import-conflicts">
                <h3>A monthly total already exists</h3>
                <p className="small muted">
                  Choose once per category/month. We never add imported payments
                  on top of a manual total.
                </p>
                {conflicts.map((c) => (
                  <fieldset key={c.key}>
                    <legend>
                      {c.month} · {c.category}
                    </legend>
                    <label>
                      <input
                        type="radio"
                        name={c.key}
                        checked={choices[c.key] === "keep-manual"}
                        onChange={() =>
                          setChoices({ ...choices, [c.key]: "keep-manual" })
                        }
                      />
                      Keep manual total ({euro(c.manualAmount, 2)}). Store the
                      payments, but exclude them from this category’s total.
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={c.key}
                        checked={choices[c.key] === "use-payments"}
                        onChange={() =>
                          setChoices({ ...choices, [c.key]: "use-payments" })
                        }
                      />
                      Replace the manual total with all recorded outgoing
                      payments ({euro(c.paymentAmount, 2)}). This may cover only
                      part of the month.
                    </label>
                  </fieldset>
                ))}
              </div>
            )}
          </section>
        )}
        <div className="import-actions">
          <p>
            {rows.length
              ? `${selected.filter((r) => r.direction === "debit").length} outgoing · ${selected.filter((r) => r.direction === "credit").length} incoming selected`
              : "Scan an image or paste a list to begin."}
          </p>
          <button className="btn secondary" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="btn" disabled={!canImport} onClick={commit}>
            {busy
              ? "Saving…"
              : `Import ${selected.length} selected payment${selected.length === 1 ? "" : "s"}`}
            <Check size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}
