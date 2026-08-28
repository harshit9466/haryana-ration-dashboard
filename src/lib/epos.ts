import { env } from "@/lib/env";

/**
 * Government Haryana ePOS API ke saath baat karne ki EK jagah.
 * Base URL, headers, timeout, cookie handling, error shape — sab yahin.
 *
 * Phase 1 me specific endpoint functions (getDealers, getStockRegister, ...)
 * isi ke upar bante hain. Route handlers seedha `fetch` kabhi na karein.
 */

const TIMEOUT_MS = 20_000;

// Firefox jaisa UA — govt portal browser hi expect karta hai.
const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Kuch ePOS endpoints session cookie (JSESSIONID) expect karte hain.
 * Jo bhi `Set-Cookie` aata hai use yaad rakhte hain aar wapas bhejte hain.
 * (Risk R1 — Phase 1 me confirm hoga cookie chahiye ya nahi.)
 */
let cookieJar = "";

function rememberCookies(res: Response): void {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    return;
  }
  const jsession = setCookie.match(/JSESSIONID=[^;]+/)?.[0];
  if (jsession) {
    cookieJar = jsession;
  }
}

export class EposError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EposError";
  }
}

type EposRequest = {
  path: string;
  method: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /**
   * Body encoding. Govt API inconsistent hai:
   *  - `"json"` (default) → API 2, 3, 4, 6
   *  - `"form"` (x-www-form-urlencoded) → API 5 (dealers). JSON bheja to 500.
   */
  encode?: "json" | "form";
  /** `"json"` (default) ya `"text"` — API 1 HTML/text deta hai. */
  parse?: "json" | "text";
  /**
   * `true` → 4xx response bhi throw nahi karega, body parse karke return karega.
   * API 6 ke liye: galat captcha pe govt `400 { responseMessage: "Captcha Invalid" }`
   * deta hai — usse humein normally handle karna hai, exception nahi.
   */
  allow4xx?: boolean;
};

function encodeBody(
  body: unknown,
  encode: "json" | "form",
): { body: string; contentType: string } {
  if (encode === "form") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(
      (body ?? {}) as Record<string, unknown>,
    )) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    return {
      body: params.toString(),
      contentType: "application/x-www-form-urlencoded",
    };
  }
  return { body: JSON.stringify(body), contentType: "application/json" };
}

async function request<T>({
  path,
  method,
  query,
  body,
  encode = "json",
  parse = "json",
  allow4xx = false,
}: EposRequest): Promise<T> {
  const url = new URL(path, env().EPOS_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const encoded = body !== undefined ? encodeBody(body, encode) : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...BASE_HEADERS,
        ...(encoded ? { "Content-Type": encoded.contentType } : {}),
        ...(cookieJar ? { Cookie: cookieJar } : {}),
        Referer: `${env().EPOS_BASE_URL}/`,
      },
      body: encoded ? encoded.body : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    rememberCookies(res);

    const soft4xx =
      allow4xx && res.status >= 400 && res.status < 500;

    if (!res.ok && !soft4xx) {
      const snippet = (await res.text().catch(() => "")).slice(0, 160);
      throw new EposError(
        `ePOS ${method} ${path} → HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`,
        res.status,
      );
    }

    if (parse === "text") {
      return (await res.text()) as T;
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new EposError(
        `ePOS ${path} ne valid JSON nahi diya (mila: ${text.slice(0, 120)}…)`,
      );
    }
  } catch (err) {
    if (err instanceof EposError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new EposError(`ePOS ${path} timeout (${TIMEOUT_MS}ms)`);
    }
    throw new EposError(
      `ePOS ${path} reachable nahi: ${err instanceof Error ? err.message : "unknown"}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function eposGet<T>(
  path: string,
  query?: EposRequest["query"],
  parse?: EposRequest["parse"],
): Promise<T> {
  return request<T>({ path, method: "GET", query, parse });
}

export function eposPost<T>(
  path: string,
  body: unknown,
  opts?: {
    encode?: EposRequest["encode"];
    parse?: EposRequest["parse"];
    allow4xx?: boolean;
  },
): Promise<T> {
  return request<T>({
    path,
    method: "POST",
    body,
    encode: opts?.encode,
    parse: opts?.parse,
    allow4xx: opts?.allow4xx,
  });
}
