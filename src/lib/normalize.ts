/**
 * Government ePOS API data quirks — sab ek jagah handle.
 * (Details: docs/PLAN.md section 5)
 */

const IST_TZ = "Asia/Kolkata";

/** ePOS ka numeric field: kabhi `5285.59`, kabhi `{ source: "2078.0", parsedValue: 2078 }`. */
export function num(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && "parsedValue" in value) {
    return num((value as { parsedValue: unknown }).parsedValue);
  }
  return 0;
}

/** Safe string — `null`, `"NA"`, `"null"` sab `""` ban jaate hain. */
export function str(value: unknown): string {
  if (value == null) {
    return "";
  }
  const s = String(value).trim();
  if (s === "NA" || s === "null" || s === "undefined" || s === "-") {
    return "";
  }
  return s;
}

/** `respcode === "200"` matlab success. `respmsg` ki spelling ("Sucess"/"sucess") pe bharosa mat karo. */
export function isEposOk(body: { respcode?: unknown }): boolean {
  return str(body?.respcode) === "200";
}

/**
 * ePOS `loginTime`: `"YYYY-MM-DD HH:mm:ss"` — offset ke bina, hamesha IST.
 * Ek real `Date` deta hai (IST ko UTC me convert karke).
 */
export function parseEposDateTime(value: unknown): Date | null {
  const s = str(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi, se] = m;
  // IST = UTC + 5:30
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h - 5, +mi - 30, +se);
  return new Date(utcMs);
}

/** ePOS `auth_time` / `avail_date`: `"DD-MM-YYYY"` → `"YYYY-MM-DD"` (khaali agar parse na ho). */
export function eposDateToIso(value: unknown): string {
  const s = str(value);
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) {
    return "";
  }
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

/** Abhi ka IST date `"YYYY-MM-DD"` — monitor "aaj" compare karne ke liye. */
export function istDateKey(at: Date = new Date()): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Abhi ka IST time `"HH:mm"` (24h) — shop-hours compare ke liye. */
export function istTimeHm(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** `"HH:mm"` ko minutes-since-midnight me badlo (compare karne ke liye). */
export function hmToMinutes(hm: string): number {
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return 0;
  }
  return +m[1] * 60 + +m[2];
}

/**
 * API 1 (`getFPSs`) `text/plain` me HTML `<option>` tags deta hai, JSON nahi.
 *   <option value='108200100001' >108200100001(AMARJEET KAUR W 9)</option>
 * → [{ fpsId: "108200100001", dealerName: "AMARJEET KAUR W 9" }]
 */
export function parseFpsOptions(
  html: string,
): { fpsId: string; dealerName: string }[] {
  const out: { fpsId: string; dealerName: string }[] = [];
  const re = /<option\s+value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const fpsId = m[1].trim();
    if (!fpsId) {
      continue; // "--select--"
    }
    const text = m[2].trim();
    const paren = text.match(/\(([^)]*)\)\s*$/);
    const dealerName = str(paren ? paren[1] : text.replace(/^\d+/, ""));
    out.push({ fpsId, dealerName });
  }
  return out;
}
