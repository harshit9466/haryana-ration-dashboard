"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dealer } from "@/lib/eposTypes";

/**
 * Searchable multi-select FPS dropdown. Selected fpsIds are reported to the
 * parent via `onChange`. Used by the admin page to add several shops at once.
 */
export function FpsMultiPicker({
  dealers,
  value,
  onChange,
  exclude = [],
}: {
  dealers: Dealer[];
  value: string[];
  onChange: (fpsIds: string[]) => void;
  exclude?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);
  const selectedSet = useMemo(() => new Set(value), [value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dealers
      .filter((d) => !excludeSet.has(d.fpsId))
      .filter(
        (d) =>
          !q ||
          d.dealerName.toLowerCase().includes(q) ||
          d.fpsId.includes(q),
      )
      .slice(0, 60);
  }, [dealers, query, excludeSet]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggle(fpsId: string) {
    onChange(
      selectedSet.has(fpsId)
        ? value.filter((v) => v !== fpsId)
        : [...value, fpsId],
    );
  }

  const selectedDealers = value
    .map((id) => dealers.find((d) => d.fpsId === id))
    .filter((d): d is Dealer => Boolean(d));

  return (
    <div ref={boxRef} className="relative w-full max-w-lg">
      <label className="mb-1 block text-xs font-medium text-muted">
        Fair Price Shops
      </label>

      {selectedDealers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedDealers.map((d) => (
            <span
              key={d.fpsId}
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs"
            >
              {d.dealerName || d.fpsId}
              <button
                type="button"
                onClick={() => toggle(d.fpsId)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm"
      >
        <span className="text-muted">
          {value.length ? `${value.length} selected — add more` : "Select shops…"}
        </span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or FPS id…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted">No matches</li>
            )}
            {results.map((d) => (
              <li key={d.fpsId}>
                <button
                  type="button"
                  onClick={() => toggle(d.fpsId)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-background"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedSet.has(d.fpsId)}
                    className="pointer-events-none"
                  />
                  <span className="flex flex-col">
                    <span>{d.dealerName || "(no name)"}</span>
                    <span className="font-mono text-xs text-muted">
                      {d.fpsId}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
