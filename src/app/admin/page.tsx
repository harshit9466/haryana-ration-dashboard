export default function AdminPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Monitor Setup</h1>
      <p className="max-w-2xl text-sm text-muted">
        Apni FPS(s) select karo, notification email daalo, shop hours set karo.
        Phir shop jab din ki pehli ration de → email; din ke end me → summary email.
      </p>
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Phase 4–5 me aayega (DB + cron + Resend).
      </p>
    </div>
  );
}
