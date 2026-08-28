# Haryana Ration Dashboard

Personal-use website jo Haryana PDS / ePOS (`epos.haryanafood.gov.in`) ke public
transparency APIs ko ek saaf dashboard me dikhata hai, plus ek **daily email monitor**
for a chosen Fair Price Shop (FPS).

- **Dashboard** — kisi bhi FPS ka stock register, date-wise sale, har transaction, dealer info.
- **Card Lookup** — ration card number + captcha → members / entitlement / auth history.
- **Monitor** — selected FPS din ki pehli ration de → email; din ke end me → summary email.

Full design: [`docs/PLAN.md`](docs/PLAN.md).

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 · Prisma 7 + PostgreSQL · Resend (email) ·
deploy: Railway (`web` + `cron` services + Postgres).

Data kabhi store nahi hota — sab govt API se live. DB sirf monitor config + daily flags ke liye.

## Local setup

```bash
cp .env.example .env        # values bharo (DEFAULT_SRC_NO, ADMIN_PASSWORD, etc.)
docker compose up -d db     # local Postgres :5432
npm install
npm run db:migrate          # schema apply (DB running hona chahiye)
npm run dev                 # http://localhost:3000
```

Zaroori commands:

| Command | Kaam |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Nayi migration banao + apply (dev) |
| `npm run db:deploy` | Pending migrations apply (prod/CI) |
| `npm run db:studio` | Prisma Studio |

## Environment

Dekho [`.env.example`](.env.example). Prod values Railway service variables me — repo me kabhi nahi.

## Deploy (Railway)

`docs/PLAN.md` section 11. Do services ek repo se: `web` (Next.js) + `cron` (har 15 min
`/api/cron/poll` hit karta hai) + Postgres plugin.
