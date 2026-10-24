import { moneyText, validDate } from "./model";
import { type ReviewRow, suggestCategory } from "./payments";
const months: Record<string, number> = {
  jan: 1,
  januar: 1,
  january: 1,
  feb: 2,
  februar: 2,
  february: 2,
  mar: 3,
  mär: 3,
  maerz: 3,
  märz: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  mai: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  okt: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  dez: 12,
  dezember: 12,
  december: 12,
};
const datePattern =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./](?:\d{4}|\d{2}))?|\d{1,2}\.?\s+(?:January|Januar|February|Februar|March|März|Maerz|April|May|Mai|June|Juni|July|Juli|August|September|October|Oktober|November|December|Dezember|Jan|Feb|Mar|Mär|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Okt|Nov|Dec|Dez)\.?\s*(?:\d{4})?)\b/i;
const amountPattern =
  /(?<![\d.,])(?:[+\-]\s*)?(?:EUR\s*|€\s*)?\d+(?:[.,\s]\d{3})*[.,]\d{2}(?![\d.,])(?:\s*(?:EUR|€))?(?:\s*[+\-](?!\d))?/gi;
function parseDate(
  text: string,
  year: number,
): { date: string; inferred: boolean } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return { date: validDate(text) ? text : "", inferred: false };
  const numeric = text.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/);
  const named = text.match(/^(\d{1,2})\.?\s+([\p{L}]+)\.?\s*(\d{4})?$/u);
  const day = Number(numeric?.[1] ?? named?.[1]);
  const month = numeric
    ? Number(numeric[2])
    : months[named?.[2].toLowerCase() ?? ""];
  const y = numeric?.[3] ?? named?.[3];
  const resolved = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : year;
  const date = `${resolved}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { date: validDate(date) ? date : "", inferred: !y };
}
function parseAmount(text: string): {
  amount: string;
  direction: ReviewRow["direction"];
} {
  const direction = text.includes("-")
    ? "debit"
    : text.includes("+")
      ? "credit"
      : "unknown";
  const digits = text.replace(/EUR|€|[+\-\s]/gi, "");
  const separator = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
  const integer = digits.slice(0, separator).replace(/[.,]/g, "");
  const decimal = digits.slice(separator + 1);
  const cents = Number(integer) * 100 + Number(decimal);
  return {
    amount: Number.isSafeInteger(cents) && cents > 0 ? moneyText(cents) : "",
    direction,
  };
}
export function parseScreenshotText(
  raw: string,
  year: number,
): { rows: ReviewRow[]; unmatched: string[] } {
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    throw new Error("Choose a valid year for dates without a year.");
  if (raw.length > 60000)
    throw new Error("Text is too long. Import a smaller screenshot.");
  const rows: ReviewRow[] = [],
    unmatched: string[] = [];
  let date = "",
    inferred = false;
  let descriptionLines: string[] = [];
  for (const original of raw.split(/\r?\n/)) {
    let line = original
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/[\u00a0\u202f]/g, " ");
    if (!line) continue;
    if (
      /\b(balance|kontostand|saldo|available|total|summe|gesamt|verfügbar)\b/i.test(
        line,
      )
    ) {
      unmatched.push(original);
      continue;
    }
    // Remove an amount first when finding dates: decimal amounts must not become dates.
    if (
      /^(?:date|datum|transactions|payments|zahlungen|umsätze|description|beschreibung|betrag)(?:\s|$)/i.test(
        line,
      )
    ) {
      unmatched.push(original);
      continue;
    }
    const withoutAmounts = line.replace(amountPattern, " ");
    const leading = line.match(datePattern);
    const leadingIsDate =
      leading?.index === 0 &&
      !!parseDate(leading[0].trim(), year).date &&
      !/^[+\-]|€|EUR/i.test(line) &&
      (leading[0].length === line.length ||
        /^\s+[^\d€]/.test(line.slice(leading[0].length)) ||
        /\d{4}/.test(leading[0]));
    const match = leadingIsDate ? leading : withoutAmounts.match(datePattern);
    if (match) {
      const parsed = parseDate(match[0].trim(), year);
      date = parsed.date;
      inferred = parsed.inferred;
      line = line.replace(match[0], "").trim();
      if (!line) {
        descriptionLines = [];
        continue;
      }
    }
    const amounts = [...line.matchAll(amountPattern)];
    if (!amounts.length) {
      descriptionLines.push(line);
      unmatched.push(original);
      continue;
    }
    const monetary = amounts.at(-1)!;
    const parsedAmount = parseAmount(monetary[0]);
    let description = line
      .replace(amountPattern, "")
      .replace(/^[\s|:·]+|[\s|:·]+$/g, "")
      .trim();
    if (descriptionLines.length)
      description = [...descriptionLines, description]
        .filter(Boolean)
        .join(" ");
    descriptionLines = [];
    const note = [
      inferred ? `Year inferred as ${year}; check it.` : "",
      !date ? "Date not recognized." : "",
      amounts.length > 1
        ? "Multiple amounts on this line; check the payment amount."
        : "",
      parsedAmount.direction === "unknown"
        ? "Payment direction is unclear."
        : "",
      /\b(transfer|überweisung|sparplan|investment|savings plan)\b/i.test(
        description,
      )
        ? "May be a transfer or investment, not spending."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    rows.push({
      id: `scan-${rows.length}`,
      selected:
        parsedAmount.direction === "debit" &&
        !!date &&
        amounts.length === 1 &&
        !/\b(transfer|überweisung|sparplan|investment|savings plan)\b/i.test(
          description,
        ),
      date,
      description: description.slice(0, 250),
      ...parsedAmount,
      category: suggestCategory(description),
      allowDuplicate: false,
      note,
    });
    if (rows.length > 500)
      throw new Error(
        "More than 500 payments detected. Split the screenshot into smaller images.",
      );
  }
  return { rows, unmatched };
}
