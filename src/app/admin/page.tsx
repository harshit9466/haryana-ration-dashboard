import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Monitor Setup</h1>
        <p className="max-w-2xl text-sm text-muted">
          Add the Fair Price Shops you want to watch. Once all of them have
          started giving ration for the day you get one &ldquo;shops opened&rdquo;
          email, and one combined end-of-day report. A shop can be given its own
          times instead.
        </p>
      </div>
      <AdminPanel />
    </div>
  );
}
