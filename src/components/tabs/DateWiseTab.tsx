"use client";

import { useApi } from "@/lib/useApi";
import { qty } from "@/lib/format";
import type { DateWiseResult } from "@/lib/eposTypes";
import {
  Spinner,
  ErrorBox,
  Empty,
  TableScroll,
  Th,
  Td,
  TabShell,
} from "@/components/ui";

export function DateWiseTab({
  fpsId,
  month,
  year,
}: {
  fpsId: string;
  month: number;
  year: number;
}) {
  const { data, error, loading, refreshing, reload } = useApi<DateWiseResult>(
    "/api/proxy/date-wise",
    { method: "POST", body: { fpsId, month, year } },
  );

  if (loading) {
    return <Spinner label="Loading date-wise data…" />;
  }

  return (
    <TabShell refreshing={refreshing} reload={reload}>
      {error ? (
        <ErrorBox message={error} />
      ) : !data || data.days.length === 0 ? (
        <Empty>No transactions for this month.</Empty>
      ) : (
        <DateWiseTable data={data} />
      )}
    </TabShell>
  );
}

function DateWiseTable({ data }: { data: DateWiseResult }) {
  const cols = data.commodityColumns;
  const totalCards = data.days.reduce((s, d) => s + d.cards, 0);
  const colTotals = cols.map((c) =>
    data.days.reduce(
      (s, d) => s + (d.commodities.find((x) => x.commodity === c)?.qty ?? 0),
      0,
    ),
  );

  return (
    <TableScroll>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th align="right">Cards</Th>
          {cols.map((c) => (
            <Th key={c} align="right">
              {c}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.days.map((d) => (
          <tr key={d.date}>
            <Td strong>{d.date}</Td>
            <Td align="right">{d.cards}</Td>
            {cols.map((c) => {
              const v = d.commodities.find((x) => x.commodity === c)?.qty ?? 0;
              return (
                <Td key={c} align="right">
                  {v ? qty(v) : "·"}
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <Td strong>Total</Td>
          <Td align="right" strong>
            {totalCards}
          </Td>
          {colTotals.map((t, i) => (
            <Td key={cols[i]} align="right" strong>
              {qty(t)}
            </Td>
          ))}
        </tr>
      </tfoot>
    </TableScroll>
  );
}
