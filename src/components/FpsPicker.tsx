"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dealer } from "@/lib/eposTypes";

/**
 * Searchable FPS dropdown. 256 dealers — naam ya fps_id se filter.
 * Selected `fpsId` parent ko `onChange` se milta hai.
 */
export function FpsPicker({
  dealers,
  value,
  onChange,
}: {
  dealers: Dealer[];
  value: string | null;
  onChange: (fpsId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = dealers.find((d) => d.fpsId === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return dealers.slice(0, 50);
    }
    return dealers
      .filter(
        (d) =>
          d.dealerName.toLowerCase().includes(q) || d.fpsId.includes(q),
      )
      .slice(0, 50);
  }, [dealers, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <label className="mb-1 block text-xs font-medium text-muted">
        Fair Price Shop
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm"
      >
        <span className={selected ? "" : "text-muted"}>
          {selected
            ? `${selected.dealerName || "(no name)"} · ${selected.fpsId}`
            : "Select a shop…"}
        </span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Naam ya FPS id se search…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted">Kuch nahi mila</li>
            )}
            {results.map((d) => (
              <li key={d.fpsId}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(d.fpsId);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-background ${
                    d.fpsId === value ? "bg-background" : ""
                  }`}
                >
                  <span>{d.dealerName || "(no name)"}</span>
                  <span className="font-mono text-xs text-muted">
                    {d.fpsId}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {query.trim() === "" && dealers.length > 50 && (
            <p className="border-t border-border px-3 py-1.5 text-xs text-muted">
              Pehle 50 dikha rahe — search karo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
