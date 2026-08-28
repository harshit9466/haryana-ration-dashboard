/** UI formatting helpers — numbers, money, dates (sab IST). */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? String(m);
}

/** `1234.5` → `"1,234.5"` (max 2 decimals, thousands separator). */
export function qty(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** `1234.5` → `"₹1,234.50"` */
export function rupees(n: number): string {
  if (!Number.isFinite(n)) {
    return "₹0";
  }
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

/** ISO string ya "YYYY-MM-DD HH:mm:ss" → "28 Aug, 11:00 AM" (IST). */
export function dateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "+05:30";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** "2026-08-05" → "5 Aug" */
export function shortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(+m[1], +m[2] - 1, +m[3]));
}

/** `"2026-08"` (input[type=month] value) → `{ month, year }` */
export function parseMonthInput(value: string): { month: number; year: number } {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!m) {
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }
  return { month: Number(m[2]), year: Number(m[1]) };
}

/** `{ month:8, year:2026 }` → `"2026-08"` */
export function toMonthInput(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
