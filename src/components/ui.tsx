import type { ReactNode } from "react";

export function Card({
  title,
  right,
  children,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      {(title || right) && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function RefreshButton({
  onClick,
  busy = false,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Reload this data"
      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
    >
      <span className={busy ? "inline-block animate-spin" : ""}>↻</span>
      {busy ? "Refreshing…" : "Refresh"}
    </button>
  );
}

/** Wraps a tab's content with a Refresh button at the top-right. */
export function TabShell({
  refreshing,
  reload,
  children,
}: {
  refreshing: boolean;
  reload: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <RefreshButton onClick={reload} busy={refreshing} />
      </div>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted">
      <span className="size-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted">{children}</div>;
}

/** Horizontal-scroll wrapper — wide tables page ko overflow na karein. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`border-b border-border px-3 py-2 font-medium text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  strong = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`border-b border-border px-3 py-2 ${
        align === "right" ? "text-right tabular-nums" : ""
      } ${strong ? "font-medium" : ""}`}
    >
      {children}
    </td>
  );
}
