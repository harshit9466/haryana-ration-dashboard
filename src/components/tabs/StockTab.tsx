"use client";

import { useApi } from "@/lib/useApi";
import { qty, dateTime } from "@/lib/format";
import type { StockResult } from "@/lib/eposTypes";
import {
  Spinner,
  ErrorBox,
  Empty,
  TableScroll,
  Th,
  Td,
  TabShell,
} from "@/components/ui";

export function StockTab({
  fpsId,
  month,
  year,
}: {
  fpsId: string;
  month: number;
  year: number;
}) {
  const { data, error, loading, refreshing, reload } = useApi<StockResult>(
    "/api/proxy/stock-register",
    { method: "POST", body: { fpsId, month, year } },
  );

  if (loading) {
    return <Spinner label="Loading stock register…" />;
  }

  return (
    <TabShell refreshing={refreshing} reload={reload}>
      {error ? (
        <ErrorBox message={error} />
      ) : !data || data.rows.length === 0 ? (
        <Empty>No stock records for this month.</Empty>
      ) : (
        <>
          <TableScroll>
            <thead>
              <tr>
                <Th>Commodity</Th>
                <Th>Unit</Th>
                <Th align="right">Allotted</Th>
                <Th align="right">Opening</Th>
                <Th align="right">Received</Th>
                <Th align="right">Issued</Th>
                <Th align="right">Closing</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.commodityId}>
                  <Td strong>{r.commodity}</Td>
                  <Td>{r.unit}</Td>
                  <Td align="right">{qty(r.allotted)}</Td>
                  <Td align="right">{qty(r.opening)}</Td>
                  <Td align="right">{qty(r.received)}</Td>
                  <Td align="right">{qty(r.issued)}</Td>
                  <Td align="right" strong>
                    {qty(r.closing)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
          {data.refreshedAt && (
            <p className="text-xs text-muted">
              Govt refresh: {dateTime(data.refreshedAt)}
            </p>
          )}
        </>
      )}
    </TabShell>
  );
}
