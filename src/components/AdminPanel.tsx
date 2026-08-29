"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { dateTime } from "@/lib/format";
import type { DealersResult } from "@/lib/eposTypes";
import { FpsMultiPicker } from "@/components/FpsMultiPicker";
import { Card, Spinner, ErrorBox, Empty } from "@/components/ui";

type Shop = {
  id: number;
  fpsId: string;
  label: string;
  distCode: string;
  pollEnabled: boolean;
  reportTimes: string[];
  reportsSent: string[];
  today: {
    openedAt: string | null;
    firstTxnAt: string | null;
    lastSeenTxnCount: number;
    lastPolledAt: string | null;
  } | null;
};

type ConfigData = { globalReportsSent: string[]; shops: Shop[] };
type SettingsData = { notifyEmails: string[]; reportTimes: string[] };

export function AdminPanel() {
  const dealersApi = useApi<DealersResult>("/api/proxy/dealers");
  const configApi = useApi<ConfigData>("/api/admin/config");
  const settingsApi = useApi<SettingsData>("/api/admin/settings");

  if (dealersApi.loading || configApi.loading || settingsApi.loading) {
    return <Spinner label="Loading setup…" />;
  }

  const dealers = dealersApi.data?.dealers ?? [];
  const data = configApi.data ?? { globalReportsSent: [], shops: [] };
  const settings = settingsApi.data;

  return (
    <div className="space-y-6">
      {settings && (
        <SettingsCard initial={settings} onSaved={() => settingsApi.reload()} />
      )}

      <Card
        title="Monitored shops"
        right={<PollButtons onDone={() => configApi.reload()} />}
      >
        {configApi.error ? (
          <ErrorBox message={configApi.error} />
        ) : data.shops.length === 0 ? (
          <Empty>No shops monitored yet. Add some below.</Empty>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">
              Today&apos;s global reports sent:{" "}
              {data.globalReportsSent.length
                ? data.globalReportsSent.join(", ")
                : "none yet"}
            </p>
            <ul className="divide-y divide-border">
              {data.shops.map((s) => (
                <ShopRow
                  key={s.id}
                  shop={s}
                  onChanged={() => configApi.reload()}
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Add shops">
        <AddShops
          dealers={dealers}
          existing={data.shops.map((s) => s.fpsId)}
          onAdded={() => configApi.reload()}
        />
      </Card>

      <Card title="Test email">
        <TestEmail defaultEmail={settings?.notifyEmails[0] ?? ""} />
      </Card>
    </div>
  );
}

// ── time list editor ──────────────────────────────────────────────
function TimeListEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((t, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1"
        >
          <input
            type="time"
            value={t}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="text-xs text-muted hover:text-foreground"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, "12:00"])}
        className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted hover:text-foreground"
      >
        + add time
      </button>
    </div>
  );
}

// ── global settings ───────────────────────────────────────────────
function SettingsCard({
  initial,
  onSaved,
}: {
  initial: SettingsData;
  onSaved: () => void;
}) {
  const [emails, setEmails] = useState(initial.notifyEmails.join(", "));
  const [times, setTimes] = useState<string[]>(initial.reportTimes);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyEmails: emails
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        reportTimes: times,
      }),
    });
    const json = await res.json();
    setSaving(false);
    setMsg(
      json.ok
        ? { ok: true, text: "Saved ✓" }
        : { ok: false, text: json.error ?? "Save failed" },
    );
    if (json.ok) {
      setTimes(json.data.reportTimes ?? times);
      onSaved();
    }
  }

  return (
    <Card title="Settings">
      <form onSubmit={save} className="space-y-4 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Notification emails (comma-separated)
          </span>
          <input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">
            Report times (IST) — a status email goes out at each. The last one is
            your end-of-day report. Checked every ~15 min.
          </span>
          <TimeListEditor value={times} onChange={setTimes} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg && (
          <span
            className={`ml-3 text-sm ${msg.ok ? "text-accent" : "text-red-600"}`}
          >
            {msg.text}
          </span>
        )}
      </form>
    </Card>
  );
}

// ── one shop row (with inline edit) ──────────────────────────────
function ShopRow({
  shop,
  onChanged,
}: {
  shop: Shop;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [times, setTimes] = useState<string[]>(shop.reportTimes);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fpsId: shop.fpsId,
        label: shop.label,
        distCode: shop.distCode,
        pollEnabled: shop.pollEnabled,
        reportTimes: shop.reportTimes,
        ...body,
      }),
    });
    setBusy(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/admin/config?fpsId=${shop.fpsId}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  const t = shop.today;
  const status = !t
    ? "not checked yet today"
    : t.openedAt
      ? `open${t.firstTxnAt ? " since " + dateTime(t.firstTxnAt) : ""} · ${t.lastSeenTxnCount} txns`
      : `checked ${t.lastPolledAt ? dateTime(t.lastPolledAt) : ""} — not open yet`;

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">
            {shop.label || "(no name)"}{" "}
            <span className="font-mono text-xs text-muted">{shop.fpsId}</span>
          </div>
          <div className="text-xs text-accent">{status}</div>
          <div className="text-xs text-muted">
            {shop.reportTimes.length
              ? `own report times: ${shop.reportTimes.join(", ")}`
              : "in the global report"}
            {shop.reportsSent.length
              ? ` · sent today: ${shop.reportsSent.join(", ")}`
              : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => patch({ pollEnabled: !shop.pollEnabled })}
            disabled={busy}
            className={`rounded-md border px-2 py-1 text-xs ${
              shop.pollEnabled
                ? "border-accent bg-accent/10"
                : "border-border text-muted"
            }`}
          >
            {shop.pollEnabled ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-border px-2 py-1 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-border px-2 py-1 text-xs text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <p className="mb-2 text-xs text-muted">
            Leave empty to keep this shop in the combined global report. Add times
            to get a separate email for just this shop instead.
          </p>
          <TimeListEditor value={times} onChange={setTimes} />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await patch({ reportTimes: times });
              setEditing(false);
            }}
            className="mt-3 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </li>
  );
}

// ── add shops (multiselect) ─────────────────────────────────────
function AddShops({
  dealers,
  existing,
  onAdded,
}: {
  dealers: DealersResult["dealers"];
  existing: string[];
  onAdded: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (picked.length === 0) {
      return;
    }
    setSaving(true);
    setMsg(null);
    const shops = picked.map((fpsId) => ({
      fpsId,
      label: dealers.find((d) => d.fpsId === fpsId)?.dealerName ?? "",
    }));
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shops }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setMsg({ ok: true, text: `Added ${json.data.added} shop(s)` });
      setPicked([]);
      onAdded();
    } else {
      setMsg({ ok: false, text: json.error ?? "Failed" });
    }
  }

  return (
    <div className="space-y-3">
      <FpsMultiPicker
        dealers={dealers}
        value={picked}
        onChange={setPicked}
        exclude={existing}
      />
      <button
        type="button"
        onClick={add}
        disabled={picked.length === 0 || saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving
          ? "Adding…"
          : `Add ${picked.length || ""} shop${picked.length === 1 ? "" : "s"}`.trim()}
      </button>
      {msg && (
        <span
          className={`ml-3 text-sm ${msg.ok ? "text-accent" : "text-red-600"}`}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}

// ── poll buttons ───────────────────────────────────────────────
function PollButtons({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState<"" | "check" | "report">("");
  const [note, setNote] = useState<string | null>(null);

  async function hit(path: string, which: "check" | "report") {
    setBusy(which);
    setNote(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      setNote(
        json.ok
          ? json.data.results
              .map(
                (r: { scope: string; action: string }) =>
                  `${r.scope}: ${r.action}`,
              )
              .join(" · ") || "nothing to do"
          : (json.error ?? "failed"),
      );
    } catch {
      setNote("network error");
    } finally {
      setBusy("");
      onDone();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {note && (
        <span className="max-w-sm truncate text-xs text-muted" title={note}>
          {note}
        </span>
      )}
      <button
        type="button"
        onClick={() => hit("/api/admin/run-poll", "check")}
        disabled={busy !== ""}
        className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
      >
        {busy === "check" ? "Checking…" : "Check now"}
      </button>
      <button
        type="button"
        onClick={() => hit("/api/admin/report-now", "report")}
        disabled={busy !== ""}
        className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
      >
        {busy === "report" ? "Sending…" : "Send report now"}
      </button>
    </div>
  );
}

function TestEmail({ defaultEmail }: { defaultEmail: string }) {
  const [typed, setTyped] = useState<string | null>(null);
  const email = typed ?? defaultEmail;
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    setState(null);
    const res = await fetch("/api/admin/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [email.trim()] }),
    });
    const json = await res.json();
    setSending(false);
    setState(
      json.ok
        ? { ok: true, text: "Sent — check the inbox" }
        : { ok: false, text: json.error ?? "Failed" },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={email}
        onChange={(e) => setTyped(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
      <button
        type="button"
        onClick={send}
        disabled={sending || !email}
        className="rounded-md border border-border px-3 py-2 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send test"}
      </button>
      {state && (
        <span className={state.ok ? "text-accent" : "text-red-600"}>
          {state.text}
        </span>
      )}
    </div>
  );
}
