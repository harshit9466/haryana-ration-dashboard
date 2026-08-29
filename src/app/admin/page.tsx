import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Monitor Setup</h1>
        <p className="max-w-2xl text-sm text-muted">
          Add the Fair Price Shops you want to watch and set your report times.
          At each time you get one status email — which shops are open, since
          when, and what they&apos;ve dispensed so far. A shop can be given its
          own report times instead.
        </p>
      </div>
      <AdminPanel />
    </div>
  );
}
