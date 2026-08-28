"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import type { Dealer, DealersResult } from "@/lib/eposTypes";
import { FpsPicker } from "@/components/FpsPicker";
import { Card, Spinner, ErrorBox, Empty } from "@/components/ui";

type MonitorConfig = {
  id: number;
  fpsId: string;
  label: string;
  distCode: string;
  emails: string[];
  shopOpen: string;
  shopClose: string;
  eodTime: string;
  pollEnabled: boolean;
};

export function AdminPanel() {
  const dealersApi = useApi<DealersResult>("/api/proxy/dealers");
  const configsApi = useApi<MonitorConfig[]>("/api/admin/config");
  const cfg = useApi<{ notifyEmail: string }>("/api/config");

  const dealers = dealersApi.data?.dealers ?? [];
  const configs = configsApi.data ?? [];

  // form fields ki initial value config se aati hai — pehle load hone do
  if (cfg.loading || dealersApi.loading) {
    return <Spinner label="Setup load ho raha hai…" />;
  }
  const defaultEmail = cfg.data?.notifyEmail ?? "";

  return (
    <div className="space-y-6">
      <Card title="Monitored shops">
        {configsApi.loading ? (
          <Spinner />
        ) : configsApi.error ? (
          <ErrorBox message={configsApi.error} />
        ) : configs.length === 0 ? (
          <Empty>Abhi koi FPS monitor nahi ho rahi. Neeche se add karo.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {configs.map((c) => (
              <ConfigRow
                key={c.id}
                config={c}
                onChanged={() => configsApi.reload()}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add / update a shop">
        <ConfigForm
          dealers={dealers}
          defaultEmail={defaultEmail}
          onSaved={() => configsApi.reload()}
        />
      </Card>

      <Card title="Test email">
        <TestEmail defaultEmail={defaultEmail} />
      </Card>
    </div>
  );
}

function ConfigRow({
  config,
  onChanged,
}: {
  config: MonitorConfig;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, pollEnabled: !config.pollEnabled }),
    });
    setBusy(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/admin/config?fpsId=${config.fpsId}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div>
        <div className="font-medium">
          {config.label || "(no name)"}{" "}
          <span className="font-mono text-xs text-muted">{config.fpsId}</span>
        </div>
        <div className="text-xs text-muted">
          {config.emails.join(", ")} · poll {config.shopOpen}–{config.shopClose} ·
          EOD {config.eodTime}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`rounded-md border px-2 py-1 text-xs ${
            config.pollEnabled
              ? "border-accent bg-accent/10"
              : "border-border text-muted"
          }`}
        >
          {config.pollEnabled ? "ON" : "OFF"}
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
    </li>
  );
}

function ConfigForm({
  dealers,
  defaultEmail,
  onSaved,
}: {
  dealers: Dealer[];
  defaultEmail: string;
  onSaved: () => void;
}) {
  const [fpsId, setFpsId] = useState<string | null>(null);
  const [emails, setEmails] = useState(defaultEmail);
  const [shopOpen, setShopOpen] = useState("05:00");
  const [shopClose, setShopClose] = useState("14:00");
  const [eodTime, setEodTime] = useState("21:00");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dealer = dealers.find((d) => d.fpsId === fpsId) ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!fpsId) {
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fpsId,
        label: dealer?.dealerName ?? "",
        distCode: dealer ? "073" : "073",
        emails: emails
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        shopOpen,
        shopClose,
        eodTime,
        pollEnabled: true,
      }),
    });
    const json = await res.json();
    setSaving(false);
    setMsg(
      json.ok
        ? { ok: true, text: "Saved ✓" }
        : { ok: false, text: json.error ?? "Save fail" },
    );
    if (json.ok) {
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <FpsPicker dealers={dealers} value={fpsId} onChange={setFpsId} />
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted">
          Notification emails (comma se alag)
        </span>
        <input
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-3 text-sm">
        <TimeField label="Poll from" value={shopOpen} onChange={setShopOpen} />
        <TimeField label="Poll till" value={shopClose} onChange={setShopClose} />
        <TimeField label="EOD mail at" value={eodTime} onChange={setEodTime} />
      </div>
      <button
        type="submit"
        disabled={!fpsId || saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {msg && (
        <span
          className={`ml-3 text-sm ${msg.ok ? "text-accent" : "text-red-600"}`}
        >
          {msg.text}
        </span>
      )}
    </form>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
}

function TestEmail({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
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
        ? { ok: true, text: "Bhej diya — inbox check karo" }
        : { ok: false, text: json.error ?? "Fail" },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
