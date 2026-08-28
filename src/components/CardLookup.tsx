"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { parseMonthInput, toMonthInput, qty } from "@/lib/format";
import type { BeneficiaryResult, Captcha } from "@/lib/eposTypes";
import { Card, ErrorBox, Empty, TableScroll, Th, Td } from "@/components/ui";

type Success = Extract<BeneficiaryResult, { ok: true }>;

export function CardLookup({ initialRc = "" }: { initialRc?: string }) {
  const config = useApi<{ defaultSrcNo: string }>("/api/config");
  const captcha = useApi<Captcha>("/api/proxy/captcha");

  // priority: what the user typed > URL param (?rc=) > config default
  const [typedSrcNo, setTypedSrcNo] = useState<string | null>(null);
  const srcNo =
    typedSrcNo ?? (initialRc || config.data?.defaultSrcNo || "");

  const [monthInput, setMonthInput] = useState(() => {
    const n = new Date();
    return toMonthInput(n.getMonth() + 1, n.getFullYear());
  });
  const [captchaText, setCaptchaText] = useState("");

  const [result, setResult] = useState<Success | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { month, year } = parseMonthInput(monthInput);
    try {
      const res = await fetch("/api/proxy/beneficiary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srcNo,
          month,
          year,
          captcha: captchaText,
          salt: captcha.data?.salt ?? "",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data as Success);
      } else {
        setResult(null);
        setError(json.error ?? "Lookup failed");
        // wrong / expired captcha → get a fresh one
        captcha.reload();
        setCaptchaText("");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">
            Ration card (SRC) number
          </span>
          <input
            value={srcNo}
            onChange={(e) => setTypedSrcNo(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="12-digit card number"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Month</span>
          <input
            type="month"
            value={monthInput}
            max={toMonthInput(
              new Date().getMonth() + 1,
              new Date().getFullYear(),
            )}
            onChange={(e) => setMonthInput(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">
            Captcha
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {captcha.loading ? (
              <span className="text-xs text-muted">loading captcha…</span>
            ) : captcha.data?.imageDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={captcha.data.imageDataUri}
                alt="captcha"
                className="h-10 rounded border border-border bg-white"
              />
            ) : (
              <span className="text-xs text-red-600">
                captcha failed to load
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                captcha.reload();
                setCaptchaText("");
              }}
              className="text-xs text-muted underline"
            >
              refresh
            </button>
            <input
              value={captchaText}
              onChange={(e) => setCaptchaText(e.target.value)}
              placeholder="type what you see"
              autoFocus={Boolean(initialRc)}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting || !srcNo || !captchaText}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Looking up…" : "Lookup"}
          </button>
        </div>
      </form>

      {error && <ErrorBox message={error} />}
      {result && <BeneficiaryView data={result} />}
    </div>
  );
}

function BeneficiaryView({ data }: { data: Success }) {
  return (
    <div className="space-y-4">
      <Card title={`Members · RC ${data.rc}`}>
        {data.members.length === 0 ? (
          <Empty>No members found.</Empty>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Gender</Th>
                <Th align="right">Age</Th>
                <Th>Mobile</Th>
                <Th>Scheme</Th>
                <Th>KYC</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.memberId}>
                  <Td strong>{m.name}</Td>
                  <Td>{m.gender}</Td>
                  <Td align="right">{m.age || "—"}</Td>
                  <Td>{m.mobile || "—"}</Td>
                  <Td>{m.scheme}</Td>
                  <Td>{m.kycUid || "—"}</Td>
                  <Td>{m.active ? "Active" : "Inactive"}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      <Card title={data.entitlementHeading || "Entitlement"}>
        {data.entitlements.length === 0 ? (
          <Empty>No entitlement data for this month.</Empty>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Commodity</Th>
                <Th>Unit</Th>
                <Th align="right">Allocated</Th>
                <Th align="right">Balance</Th>
                <Th>Month</Th>
              </tr>
            </thead>
            <tbody>
              {data.entitlements.map((e, i) => (
                <tr key={`${e.commodity}-${i}`}>
                  <Td strong>{e.commodity}</Td>
                  <Td>{e.unit}</Td>
                  <Td align="right">{qty(e.allocated)}</Td>
                  <Td align="right">{qty(e.balance)}</Td>
                  <Td>{e.month}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      <Card title={data.authHeading || "Authentications"}>
        {data.authentications.length === 0 ? (
          <Empty>No authentications this month.</Empty>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Member</Th>
                <Th>Type</Th>
                <Th>Result</Th>
                <Th>FPS</Th>
              </tr>
            </thead>
            <tbody>
              {data.authentications.map((a, i) => (
                <tr key={i}>
                  <Td strong>{a.date}</Td>
                  <Td>{a.member}</Td>
                  <Td>{a.authType}</Td>
                  <Td>{a.result}</Td>
                  <Td>{a.fpsId}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      <Card title={data.txnHeading || "Transactions"}>
        {data.transactions.length === 0 ? (
          <Empty>No transactions this month.</Empty>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Member</Th>
                <Th>Type</Th>
                <Th>FPS</Th>
                <Th>Commodities</Th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t, i) => (
                <tr key={i}>
                  <Td strong>{t.date}</Td>
                  <Td>{t.member}</Td>
                  <Td>{t.status}</Td>
                  <Td>{t.fpsId}</Td>
                  <Td>
                    {t.commodities
                      .map((c) => `${c.commodity} ${qty(c.qty)}`)
                      .join(", ") || "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
