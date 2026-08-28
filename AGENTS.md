<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Haryana Ration Dashboard — project rules

**Full context:** `docs/PLAN.md`. Communication with Harshit: Hinglish.

## Kya ye app hai / nahi hai

- Ye ek **read-through dashboard** hai Haryana ePOS ke 7 public APIs ke upar + ek email monitor.
- Ration / stock / transaction data **kabhi DB me store nahi hota** — hamesha govt API se live.
- DB (Postgres, Prisma 7) sirf: `MonitorConfig`, `DailyMonitorState`, `EmailLog`.

## Layer rules

- **Route handlers** (`src/app/api/**/route.ts`): sirf (1) zod validate, (2) `lib/epos.ts` call,
  (3) `lib/normalize.ts` se saaf, (4) `lib/http.ts` envelope return. Koi business logic nahi.
- **Govt API sirf `src/lib/epos.ts` se** call hoti hai — kahin aur `fetch("https://epos...")` nahi.
- **Har numeric govt field `num()` se guzaarna** — kabhi number, kabhi `{source,parsedValue}` object.
- Success check: `respcode === "200"` (spelling "Sucess"/"sucess" pe bharosa mat karo).
- Dates: govt `loginTime` = IST bina offset. `Asia/Kolkata` everywhere. Helpers `lib/normalize.ts` me.

## Prisma 7 (NOT the Prisma you may know)

- Generator `prisma-client` → output `src/generated/prisma/` (gitignored, `postinstall` regenerates).
- Client import: `import { PrismaClient } from "@/generated/prisma/client"`.
- PostgreSQL driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` — dekho `src/lib/db.ts`.
- CLI config: `prisma7.config.ts` (schema me `datasource.url` nahi hai — config file me hai).
- Schema change ke baad: `npm run db:migrate` (dev), phir `prisma generate` apne aap.

## Deploy

Railway, 2 services ek repo se: `web` (Next.js) + `cron` (har 15 min `/api/cron/poll`). Postgres plugin.
Secrets Railway variables me — repo me kabhi nahi. `DEFAULT_SRC_NO` (Harshit ka card) `.env.example` me placeholder.

