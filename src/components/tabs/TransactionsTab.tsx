"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { qty, rupees, dateTime, shortDate } from "@/lib/format";
import type { TransactionsResult } from "@/lib/eposTypes";
import { Spinner, ErrorBox, Empty, TableScroll, Th, Td } from "@/components/ui";

export function TransactionsTab({
  fpsId,
  month,
  year,
}: {
  fpsId: string;
  month: number;
  year: number;
}) {
  const [day, setDay] = useState<string | null>(null);

  const summary = useApi<TransactionsResult>("/api/proxy/transactions", {
    method: "POST",
    body: { fpsId, month, year },
  });

  const dayView = useApi<TransactionsResult>("/api/proxy/transactions", {
    method: "POST",
    body: { fpsId, month, year, date: day },
    enabled: day !== null,
  });

  if (summary.loading) {
    return <Spinner label="Transactions aa rahi hain (poora mahina)…" />;
  }
  if (summary.error) {
    return <ErrorBox message={summary.error} />;
  }
  if (!summary.data || summary.data.count === 0) {
    return <Empty>Is mahine ki koi transaction nahi.</Empty>;
  }

  const s = summary.data;

  return (
    <div className="space-y-4">
      {/* month summary */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-background px-2 py-1">
          <strong>{s.count}</strong> transactions
        </span>
        <span className="rounded-md bg-background px-2 py-1">
          Total <strong>{rupees(s.totalAmount)}</strong>
        </span>
        {s.byCommodity.map((c) => (
          <span key={c.commodity} className="rounded-md bg-background px-2 py-1">
            {c.commodity}: <strong>{qty(c.qty)}</strong>
          </span>
        ))}
      </div>

      {/* day picker */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Din chuno:</span>
        {s.byDate.map((d) => (
          <button
            key={d.isoDate}
            type="button"
            onClick={() => setDay(d.isoDate === day ? null : d.isoDate)}
            className={`rounded-md border px-2 py-1 text-xs ${
              d.isoDate === day
                ? "border-accent bg-accent/10"
                : "border-border hover:border-accent"
            }`}
          >
            {shortDate(d.isoDate)} ({d.count})
          </button>
        ))}
      </div>

      {/* selected day rows */}
      {day && (
        <div>
          {dayView.loading && <Spinner label={`${shortDate(day)} ki rows…`} />}
          {dayView.error && <ErrorBox message={dayView.error} />}
          {dayView.data && dayView.data.transactions.length > 0 && (
            <TableScroll>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>RC number</Th>
                  <Th align="right">Amount</Th>
                  <Th>Commodities</Th>
                  <Th>Auth at</Th>
                  <Th>Type</Th>
                </tr>
              </thead>
              <tbody>
                {dayView.data.transactions.map((t) => (
                  <tr key={t.txnId || t.receiptId}>
                    <Td>{dateTime(t.loginTime)}</Td>
                    <Td strong>
                      <Link
                        href={`/card?rc=${encodeURIComponent(t.rc)}`}
                        className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        title="Is card ki details dekho"
                      >
                        {t.rc}
                      </Link>
                    </Td>
                    <Td align="right">{rupees(t.amount)}</Td>
                    <Td>
                      {t.commodities
                        .filter((c) => c.qty)
                        .map((c) => `${c.commodity} ${qty(c.qty)}`)
                        .join(", ") || "—"}
                    </Td>
                    <Td>{t.authAt === "Self" ? "This shop" : t.authAt}</Td>
                    <Td>{t.authType}</Td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
        </div>
      )}
    </div>
  );
}
