"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { parseMonthInput, toMonthInput } from "@/lib/format";
import type { Dealer, DealersResult } from "@/lib/eposTypes";
import { FpsPicker } from "@/components/FpsPicker";
import { Card, Spinner, ErrorBox } from "@/components/ui";
import { StockTab } from "@/components/tabs/StockTab";
import { DateWiseTab } from "@/components/tabs/DateWiseTab";
import { TransactionsTab } from "@/components/tabs/TransactionsTab";

const TABS = [
  { id: "stock", label: "Stock Register" },
  { id: "datewise", label: "Date-wise Sale" },
  { id: "txns", label: "Transactions" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function Dashboard() {
  const dealersApi = useApi<DealersResult>("/api/proxy/dealers");

  const [fpsId, setFpsId] = useState<string | null>(null);
  const [monthInput, setMonthInput] = useState(() => {
    const now = new Date();
    return toMonthInput(now.getMonth() + 1, now.getFullYear());
  });
  const [tab, setTab] = useState<TabId>("stock");

  const { month, year } = parseMonthInput(monthInput);
  const dealers = dealersApi.data?.dealers ?? [];
  const selectedDealer: Dealer | null =
    dealers.find((d) => d.fpsId === fpsId) ?? null;

  function pick(id: string) {
    setFpsId(id);
  }

  if (dealersApi.loading) {
    return <Spinner label="Dealer list load ho rahi hai…" />;
  }
  if (dealersApi.error) {
    return <ErrorBox message={`Dealer list nahi mili: ${dealersApi.error}`} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <FpsPicker dealers={dealers} value={fpsId} onChange={pick} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Month
          </label>
          <input
            type="month"
            value={monthInput}
            max={toMonthInput(
              new Date().getMonth() + 1,
              new Date().getFullYear(),
            )}
            onChange={(e) => setMonthInput(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <span className="text-xs text-muted">
          {dealersApi.data?.district} · {dealers.length} shops
        </span>
      </div>

      {selectedDealer && (
        <Card title="Dealer">
          <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <Info label="Name" value={selectedDealer.dealerName || "—"} />
            <Info label="FPS id" value={selectedDealer.fpsId} mono />
            <Info label="Mobile" value={selectedDealer.dealerMobile || "—"} />
            <Info
              label="Terminal"
              value={selectedDealer.terminalId || "—"}
              mono
            />
            <Info
              label="Nominee 1"
              value={
                selectedDealer.nominee1
                  ? `${selectedDealer.nominee1.name} · ${selectedDealer.nominee1.mobile}`
                  : "—"
              }
            />
            <Info
              label="Nominee 2"
              value={
                selectedDealer.nominee2
                  ? `${selectedDealer.nominee2.name} · ${selectedDealer.nominee2.mobile}`
                  : "—"
              }
            />
          </div>
        </Card>
      )}

      {!fpsId ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
          Upar se ek shop select karo.
        </p>
      ) : (
        <div>
          <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  tab === t.id
                    ? "border-accent font-medium"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pt-4">
            {tab === "stock" && (
              <StockTab fpsId={fpsId} month={month} year={year} />
            )}
            {tab === "datewise" && (
              <DateWiseTab fpsId={fpsId} month={month} year={year} />
            )}
            {tab === "txns" && (
              <TransactionsTab fpsId={fpsId} month={month} year={year} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1">
      <span className="text-muted">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
