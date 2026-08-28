import Link from "next/link";

const SECTIONS = [
  {
    href: "/",
    title: "Dashboard",
    status: "Phase 2",
    body: "Kisi bhi FPS ka stock register, date-wise sale, aur har transaction — ek dropdown se shop chuno.",
  },
  {
    href: "/card",
    title: "Card Lookup",
    status: "Phase 3",
    body: "Ration card number + captcha daal ke members, entitlement, authentication history dekho.",
  },
  {
    href: "/admin",
    title: "Monitor Setup",
    status: "Phase 4–5",
    body: "Apni FPS select karo — jab wo din ki pehli ration de, aur din ke end me, email aa jaayegi.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Haryana Ration Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Haryana PDS (ePOS) transparency data — saaf tarike se. Sab kuch govt API
          se live aata hai; kuch bhi store nahi hota (monitor config chhod ke).
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{s.title}</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted">
                {s.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">{s.body}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-medium">Setup chal raha hai</h2>
        <p className="mt-1 text-muted">
          Phase 0 (scaffold) done. Agla: proxy routes + dashboard UI. Detail{" "}
          <code className="font-mono text-xs">docs/PLAN.md</code> me.
        </p>
      </section>
    </div>
  );
}
