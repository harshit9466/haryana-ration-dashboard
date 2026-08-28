# Haryana Ration Dashboard — Plan

> Personal-use website jo Haryana PDS (ePOS) ke public transparency APIs ko ek saaf
> dashboard me dikhata hai, plus ek **daily email monitor** for a chosen Fair Price Shop (FPS).
>
> Status: **PLAN — review pending**. Code abhi likha nahi gaya.
> Owner: Harshit (`harshit9466@gmail.com`)
> Last updated: 2026-08-28

---

## 1. Ek line me kya ban raha hai

Ek **Next.js** app (Railway pe deploy) jo:

1. **Browse** — kisi bhi Rohtak FPS ka stock register, date-wise transactions, saari transactions,
   dealer info, aur kisi bhi ration card ki details (members + entitlement + history) dikhata hai.
2. **Monitor** — ek admin page pe tu apni FPS(s) select karta hai. Us shop ne jis din ration dena
   **shuru** kiya → ek email aata hai. Din ke **end** me → ek summary email (aaj kya-kya, kitna diya).

Data ka source = **7 government APIs** (neeche full reference). Koi API key nahi, sab public
transparency endpoints hain (`epos.haryanafood.gov.in`).

---

## 2. Tech decisions (aur kyun)

| Cheez | Choice | Kyun |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | Ek hi deploy me frontend + backend. API routes = govt API ka proxy + normalizer. React se clean tables/filters jaldi banenge. Railway pe ~80MB RAM, zero-config build. |
| Backend proxy | **Zaroori** — pure static site nahi chalegi | Govt API browser se direct call karne pe **CORS** block karega (calls same-origin se chali thीं, response me `Access-Control-Allow-Origin` nahi tha). Proxy CORS bypass karta hai + captcha/session handle karta hai + master list cache karta hai. |
| Styling | **Tailwind CSS** + headless UI components (shadcn/ui) | Fast, consistent, "easy to read" tables aur dropdowns. |
| DB | **Railway PostgreSQL** + **Prisma** | Sirf 3 chhoti tables (config + daily flags + email log). Admin page se config **runtime pe** editable hona chahiye → env var kaafi nahi, writable store chahiye. JSON file = tech debt (no concurrency safety). Postgres one-click hai Railway pe. **History/snapshots store NAHI ho rahe** — govt API khud month/year se purana data deti hai. |
| Email | **Resend REST API** (`POST https://api.resend.com/emails`) | Tera FlowTrack project (`…/Claude/Projects/flowtrack`) already Resend use karta hai — same pattern, same account. Sender `onboarding@resend.dev` (koi domain verify nahi karna). Raw `fetch`, koi SDK nahi (FlowTrack jaisा). ~2–4 mails/day — free tier (100/day) me bahut jagah. |
| Scheduler | **Alag Railway "cron" service** (same repo) jo `/api/cron/poll` ko hit karta hai | Web service ke andar `setInterval` daalna galat — restart pe timer mar jaata, koi observability nahi. Railway-native cron = reliable + manually bhi trigger ho sakta. |
| Timezone | **`Asia/Kolkata` (IST)** har jagah | Govt `loginTime` bina offset ke IST me aata hai (`2026-08-28 11:00:03`). Date math IST me hi. |
| Auth | Ek **`ADMIN_PASSWORD`** env var, Next.js middleware me check (HTTP Basic) | Personal site — poori site password ke peeche. Koi user account system nahi. |

---

## 3. The 7 APIs — full reference

**Base:** `https://epos.haryanafood.gov.in`
**Common:** koi auth header nahi dikha. Sirf API 1 me `JSESSIONID` cookie thi — implement karte
waqt confirm karenge ki cookie chahiye ya nahi (99% public hai).
**Har response me numeric fields kabhi bare number, kabhi `{source, parsedValue}` object** —
section 5 dekh.

Payload tags:
- 🔴 **DYNAMIC** — har call pe badalta hai (master list se ya user input se aata hai)
- 🟡 **DEFAULT** — prefilled hota hai (aaj ka month/year, tera card no.) par user edit kar sakta hai
- 🟢 **STATIC** — hamesha same, code me hardcoded / env var

---

### API 1 — Get FPS List

| | |
|---|---|
| **Kaam** | Ek AFSO (sub-office) ke andar ki FPS shops ki list |
| **Method / URL** | `GET /Epos_Spring/Common/getFPSs` |
| **Query params** | `dist_code` 🟡 (default `073` = Rohtak) · `afso_code` 🟡 (abhi sirf `15019` = "Pr Centre Rohtak" pata hai) |

**Response:** ⚠️ **JSON nahi — `text/plain` me HTML `<option>` tags** (~110 shops, 7.4 kB):
```html
<option value="">--select--</option>
<option value='108200100001' >108200100001(AMARJEET KAUR W 9)</option>
<option value='108200100002' >108200100002(Anil kumar KHIDWALI)</option>
<option value='108200100186' >108200100186(Kamini W 31)</option>   <!-- e.g. DEFAULT_SRC_NO wale card ka home FPS -->
```
Har option: `value` = `fps_id`, text = `{fps_id}({dealer_name})`.
Proxy route ko regex se parse karke `[{ fpsId, dealerName }]` return karna hoga — `JSON.parse` nahi chalega.

**Decision:** **Primary master list = API 5 (Dealer Details)** — poore district (256 shops), साफ JSON,
`afso_code` nahi chahiye, plus nominee + mobile + terminal. API 1 optional secondary hai (AFSO-filtered
view ke liye), aur hume abhi sirf ek AFSO code (`15019`) pata hai — isliye v1 me API 5 hi use hoga,
API 1 ka HTML-parse wala route ready rakhenge par UI me baad me.

---

### API 2 — FPS Stock Register

| | |
|---|---|
| **Kaam** | Ek shop ka commodity-wise stock — opening balance, received, issued, closing balance |
| **Method / URL** | `POST /Epos_Spring/fps/getfpsStockregister` |

**Payload:**
```json
{
  "fps_id": "108200100093",   // 🔴 DYNAMIC — master list se selected FPS
  "month":  "8",              // 🟡 DEFAULT — current month (1–12, string)
  "year":   "2026"            // 🟡 DEFAULT — current year (string)
}
```

**Response:** array, har commodity ka ek object:
```jsonc
{
  "distNameEn": "Rohtak", "distCode": "073",
  "afso_name_en": "Pr Centre Rohtak", "afsoCode": "15019",
  "fpsId": "108200100093",
  "commNameEn": "Wheat", "commId": "1", "commMeasureUnit": "KG",
  "allottedQty": {…}, "ob": 5285.59, "receivedQty": {…}, "extraRo": {…},
  "sixaCase": {…}, "issuedQty": {…}, "cb": 4735.59,
  "refreshTime": "2026-08-28 12:58:33.383592+05:30",
  "prevMonth": {…}, "curntMonth": {…}, "futrMonth": {…},
  "scheme_id": null, "scheme_short_name": null, "type": null,
  "fpsStatus": null, "shopType": null
}
```
Dashboard me dikhayenge: **Commodity · Unit · Opening (ob) · Received · Issued · Closing (cb)**.

---

### API 3 — Date-wise Transactions

| | |
|---|---|
| **Kaam** | Shop ki din-b-din sale + us din kitne ration cards serve hue |
| **Method / URL** | `POST /Epos_Spring/fps/dateWiseTransDetails` |

**Payload:**
```json
{
  "dist_code": "073",           // 🟡 DEFAULT (Rohtak) — master list se derive
  "fps_id":    "108200100093",  // 🔴 DYNAMIC — selected FPS
  "month":     "8",             // 🟡 DEFAULT — current month
  "year":      "2026"           // 🟡 DEFAULT — current year
}
```

**Response:**
```jsonc
{
  "respcode": "200", "respmsg": "Sucess",
  "heading": "Transaction Details for FPS 108200100093 in August'2026",
  "monthname": "August", "year": 2026,
  "dateWiseList": [
    {
      "date": "06-08-2026",
      "avilcards": "144",                 // us din serve hue cards
      "commoditylist": [
        { "comm_short": "Wheat", "comm_id": 1,
          "sale_qty": { "source": "15.0", "parsedValue": 15 },
          "statesaleQty": {…}, "nfsasaleQty": {…} },
        …
      ]
    }
  ]
}
```
Dashboard me: ek table **Date · Cards · Wheat · Sugar · M oil · …** (commodity columns).

---

### API 4 — FPS-wise Transactions (no captcha)

| | |
|---|---|
| **Kaam** | Shop ki **har ek** transaction — card no., receipt, amount, exact time, commodities |
| **Method / URL** | `POST /Epos_Spring/fps/fpstransactionwitoutcatptcha` |
| **Note** | Endpoint ke naam me hi "witoutcatptcha" hai — koi captcha nahi. **Monitor feature isi API pe chalega.** |

**Payload:**
```json
{
  "fps_id": "108200100093",   // 🔴 DYNAMIC — selected FPS
  "month":  "8",             // 🟡 DEFAULT — current month
  "year":   "2026"           // 🟡 DEFAULT — current year
}
```

**Response:** array of transactions (sample me 477):
```jsonc
{
  "existingRcNumber": "066007843764",
  "transStatus": "F",                        // F = final/success
  "schemeShortName": "SBPL", "schemeId": "36",
  "receiptId": "332B240241663833823",
  "txnId": "NIC65683…PDSHR",
  "portCheck": "108200100111",               // kahan authenticate hua ("Self" = isi shop pe)
  "amount": "100.00",                        // cash collected (string)
  "transTime": "00.520",                     // seconds lagi
  "loginTime": "2026-08-28 11:00:03",        // IST timestamp — MONITOR ISKO USE KAREGA
  "auth_type": "Authenticated",
  "commodityList": [
    { "comm_name_en": "Wheat", "comm_id": 1, "sale_qty": 0.0 },
    { "comm_name_en": "M oil-2", "comm_id": 241, "sale_qty": 2.0 }
  ]
}
```
Dashboard me: table **Time · RC No. · Amount · Commodities (qty) · Auth at · Receipt**, filter by date.

---

### API 5 — Dealer Details  ← **PRIMARY MASTER LIST**

| | |
|---|---|
| **Kaam** | Poore district ki saari FPS shops + dealer naam + 2 nominees + terminal ID |
| **Method / URL** | `POST /Epos_Spring/api/fpsdevicemapping/device` |
| **Caching** | Response 24h cache — ye list roz nahi badalti |

**Payload:**
```json
{ "dist_code": "073" }   // 🟢 STATIC (Rohtak). Baad me district dropdown add kar sakte hain.
```

**Response:**
```jsonc
{
  "dist_name_en": "Rohtak",
  "list_size": 256,
  "list": [
    { "dist_code": "073", "dist_name_en": "Rohtak",
      "fps_id": "108200100001", "terminal_id": "XXXX-X8773",
      "del_name": "AMARJEET KAUR W 9", "del_mob": "XXXXX-X5125",
      "nom_1_name": "Sarvjyot singh", "nom_1_mob": "9050735125",
      "nom_2_name": "NA", "nom_2_mob": "NA" }
  ]
}
```
Isse banega **FPS ka searchable dropdown** (label: `del_name — fps_id`). Jo `fps_id` select
karega wo API 2/3/4 ke payload me `fps_id` ban jaayega. **Yahi wo "master list" hai jisse
dusri APIs ka payload banta hai.**

---

### API 6 — Beneficiary (Ration Card) Details

| | |
|---|---|
| **Kaam** | Ek ration card ke members, entitlement, authentication history, transactions |
| **Method / URL** | `POST /Epos_Spring/sdms/SRC_Trans_Int` |
| **Captcha** | Chahiye — API 7 se `image` + `salt` lo, user text type kare |

**Payload:** (real `src_no` env var `DEFAULT_SRC_NO` me — doc me placeholder)
```json
{
  "src_no":  "0660XXXXXXXX",   // 🟡 DEFAULT = DEFAULT_SRC_NO env. Editable.
  "month":   "8",              // 🟡 DEFAULT — current month
  "year":    "2026",           // 🟡 DEFAULT — current year
  "captcha": "c3f8qz",         // 🔴 DYNAMIC — user ne API 7 image dekh ke type kiya
  "salt":    "<uuid>"          // 🔴 DYNAMIC — API 7 se aaya (usi challenge ka)
}
```

**Response (trimmed, values redacted):**
```jsonc
{
  "respcode": "200", "respmsg": "sucess",
  "beneficaryMemberList": [
    { "member_id": "<rc><nn>", "member_name_en": "<NAME>",
      "mob_no": "9XXXXXXXXX", "active": "Active", "gender_type_gt_type_id": "Male",
      "member_age": 0, "scheme_short_name": "SBPL", "fps_id": "<fpsId>",
      "kyc_uid": "XXXX-XXXX-NNNN", "dist_name_en": "Rohtak" }
  ],
  "benficaryEntitlementHeading": "Entitlement for RC :<rc>",
  "benficaryEntitlementList": [
    { "comm_name_eng": "Sugar", "unit_type": "KG",
      "allocation_qty": "1.000", "bal_quantity_entitled": "0.000",
      "month_short_name": "August" }
  ],
  "benficaryAuthenticationsList": [
    { "fps_id": "<fpsId>", "auth_type": "Bio", "response_code": "100",
      "error_desc": "Success", "member_name_en": "<NAME>", "auth_time": "17-08-2026" }
  ],
  "benficaryTransList": [
    { "trans_status": "Bio", "port_fpsid": "<fpsId>",
      "availed_member_name": "<NAME>", "avail_date": "17-08-2026",
      "commoditylist": [ { "comm_short": "Sugar", "comm_id": 4, "allot_qty": {…} } ] }
  ]
}
```
Dashboard me 4 cards: **Members · Entitlement (is month) · Authentications · Transactions**.

---

### API 7 — Get Captcha Image

| | |
|---|---|
| **Kaam** | API 6 ke liye captcha challenge (image + salt) |
| **Method / URL** | `GET /Epos_Spring/captcha/captcha-image?t={timestamp}` |
| **Query** | `t` 🔴 = `Date.now()` (cache-buster) |

**Response:**
```json
{
  "image": "/9j/4AAQSkZJRg…",                       // base64 JPEG (NO "data:" prefix)
  "salt":  "21269471-fbab-4226-b4bf-a533f942e156"
}
```
UI: `<img src="data:image/jpeg;base64,{image}">` + refresh button. `salt` ko yaad rakho,
API 6 call ke saath bhejo.

---

## 4. Master → detail data flow

```
                        ┌─────────────────────────────┐
                        │  API 5: Dealer Details       │
   dist_code "073" ───▶ │  (cached 24h)                │
   (🟢 static)          │  → 256 FPS { fps_id, del_name }│
                        └──────────────┬──────────────┘
                                       │  user picks one FPS (searchable dropdown)
                                       ▼
                              selected fps_id  (🔴)
                     ┌─────────────────┼─────────────────┐
                     ▼                 ▼                 ▼
          ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
          │ API 2          │ │ API 3          │ │ API 4          │
          │ Stock Register │ │ Date-wise Txns │ │ All Txns       │
          │ fps_id+mm+yyyy │ │ +dist_code     │ │ fps_id+mm+yyyy │
          └────────────────┘ └────────────────┘ └───────┬────────┘
                                                        │ (also used by)
                                                        ▼
                                              ┌──────────────────────┐
                                              │  MONITOR (cron)      │
                                              │  detects 1st txn     │
                                              │  of the day → email  │
                                              └──────────────────────┘

   Separate lookup:  RC no. (🟡 default = DEFAULT_SRC_NO) + API 7 captcha ──▶ API 6 Beneficiary
```

---

## 5. Data normalization quirks (backend me ek hi jagah handle)

1. **Number-or-object.** Same field kabhi `5285.59`, kabhi `{ "source": "2078.0", "parsedValue": 2078 }`.
   ```ts
   function num(v: unknown): number {
     if (v && typeof v === "object" && "parsedValue" in v) return Number((v as any).parsedValue) || 0;
     const n = Number(v);
     return Number.isFinite(n) ? n : 0;
   }
   ```
   Har proxy route apne response ko normalize karke bhejega — frontend ko hamesha saaf `number` milega.

2. **Spelling.** `respmsg: "Sucess"` / `"sucess"` — inconsistent. Isko match mat karna; `respcode === "200"` check karo.

3. **Strings jahan number expected.** `amount: "100.00"`, `month: "8"` — parse karo.

4. **Dates.** `loginTime` = `"YYYY-MM-DD HH:mm:ss"` (IST, no offset). `auth_time`/`avail_date` = `"DD-MM-YYYY"`.
   `refreshTime` = full ISO with `+05:30`. Alag-alag parsers.

5. **`del_mob` masked** aata hai (`XXXXX-X5125`) par `nom_1_mob` full. UI me jaisa hai waisa dikhao.

6. **Missing/`NA`.** `nom_2_name: "NA"` string — empty treat karo.

---

## 6. App structure

```
haryana-ration-dashboard/
├── docs/
│   └── PLAN.md                       ← ye file
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  ← Dashboard (FPS browse)
│   │   ├── card/page.tsx             ← Ration card lookup (API 6 + 7)
│   │   ├── admin/page.tsx            ← Monitor setup
│   │   └── api/
│   │       ├── proxy/
│   │       │   ├── dealers/route.ts        → API 5  (cached)
│   │       │   ├── fps-list/route.ts       → API 1  (later)
│   │       │   ├── stock-register/route.ts → API 2
│   │       │   ├── date-wise/route.ts      → API 3
│   │       │   ├── transactions/route.ts   → API 4
│   │       │   ├── captcha/route.ts        → API 7
│   │       │   └── beneficiary/route.ts    → API 6
│   │       ├── admin/
│   │       │   ├── config/route.ts         GET/PUT MonitorConfig
│   │       │   └── test-email/route.ts     POST
│   │       └── cron/
│   │           └── poll/route.ts           ← cron service isko hit karti hai
│   ├── lib/
│   │   ├── epos.ts                   ← ek jagah: base URL, fetch wrapper, headers, error handling
│   │   ├── normalize.ts              ← num(), date parsers
│   │   ├── monitor.ts                ← detection + email-build logic
│   │   ├── mailer.ts                 ← Resend REST call + HTML templates (start / EOD / test)
│   │   ├── db.ts                     ← Prisma client
│   │   └── auth.ts                   ← basic-auth middleware helper
│   ├── components/                   ← FpsPicker, MonthYearPicker, DataTable, CaptchaBox …
│   └── middleware.ts                 ← site-wide password
├── scripts/
│   └── cron-poll.mjs                 ← cron service entrypoint (curl /api/cron/poll + retry/log)
├── .env.example
├── railway.json                     ← service config (optional)
├── Dockerfile                       ← (agar Nixpacks se dikkat aaye)
└── README.md
```

**Design rule:** har govt API = **ek route file**, jiska naam clearly batata hai kya karti hai.
Route file sirf: (1) payload validate (zod), (2) `lib/epos.ts` se call, (3) `lib/normalize.ts` se
saaf karo, (4) return. Koi business logic route me nahi.

---

## 7. Monitoring & email feature

### Kya karega

- **Setup (admin page):** ek ya zyada FPS select karo (master list se), notification email(s) daalo,
  shop hours set karo (poll kab se kab tak), poll interval, EOD summary ka time, on/off toggle.
- **Start-of-day mail:** jis din monitored FPS ki **pehli transaction** detect hui → mail:
  > 🟢 *AMARJEET KAUR (FPS 108200100093) ne aaj ration dena shuru kiya — 09:12 AM.*
  > *Ab tak: Wheat 45 kg, Sugar 12 kg · 4 cards serve hue.*
- **End-of-day mail:** EOD time pe (ya jab poll window khatam ho) → summary:
  > 📊 *Aaj ka hisaab — FPS 108200100093 (AMARJEET KAUR)*
  > *37 transactions · ~180 cards · Wheat 550 kg · Sugar 741 kg · M oil-2 874 L · Total ₹4,235*
  > *Pehli sale 09:12 AM · aakhri 06:40 PM*

### Detection logic (`/api/cron/poll`)

```
for each enabled MonitorConfig:
  now_ist = current IST time
  if now_ist < shopOpen or now_ist > eodTime:  skip
  txns = API 4 (fps_id, current month, year)
  today = txns.filter(loginTime starts with today's IST date)
  state = DailyMonitorState.upsert(fpsId, today_date)

  # start-of-day
  if today.length > 0 and state.startEmailSentAt is null:
      send start mail (first txn time, commodity totals so far, card count)
      state.startEmailSentAt = now

  state.lastSeenTxnCount = today.length
  state.lastPolledAt = now

  # end-of-day
  if now_ist >= eodTime and state.startEmailSentAt and state.eodEmailSentAt is null:
      send EOD summary (full totals from `today`)
      state.eodEmailSentAt = now
```

- **Idempotent** — DB flags se duplicate mail nahi jaayega, chahe cron 100 baar chale.
- **Naya din** = naya `DailyMonitorState` row (date-keyed), lazily banega.
- Cron service schedule: `*/15 * * * *` (har 15 min). Off-hours pe route turant `skip` return karega — sasta.
- Agar kisi din shop band (0 txns) → koi mail nahi (sahi behaviour).

### Email bhejnа (`lib/mailer.ts`)

- **Resend**, `POST https://api.resend.com/emails`, header `Authorization: Bearer ${RESEND_API_KEY}`,
  body `{ from, to: [...], subject, html }` — bilkul FlowTrack `ResendEmailService` jaisा (raw `fetch`, koi SDK nahi).
- `from` = `onboarding@resend.dev` (Resend ka shared sender — **koi domain verify nahi karna**).
- ⚠️ Shared sender ki **ek hi limitation**: sirf tere Resend-account wale email (`harshit9466@gmail.com`) pe
  bhej sakta hai. Hamारा monitor waise bhi sirf tujhe hi mail karta hai → koi dikkat nahi. Agar future
  me kisi aur ko mail bhejni ho → tab ek domain verify karna padega.
- Har send `EmailLog` me record hoga (debugging: "mail aaya kyun nahi").

### Prisma schema (draft)

```prisma
model MonitorConfig {
  id            Int      @id @default(autoincrement())
  fpsId         String   @unique
  label         String                     // dealer name, master list se
  distCode      String   @default("073")
  emails        String[]                    // notification recipients
  shopOpen      String   @default("05:00")  // IST HH:mm
  shopClose     String   @default("14:00")
  eodTime       String   @default("21:00")
  pollEnabled   Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model DailyMonitorState {
  id                Int      @id @default(autoincrement())
  fpsId             String
  date              String                  // "YYYY-MM-DD" IST
  firstTxnAt        String?                 // "HH:mm:ss"
  startEmailSentAt  DateTime?
  eodEmailSentAt    DateTime?
  lastSeenTxnCount  Int      @default(0)
  lastPolledAt      DateTime?
  @@unique([fpsId, date])
}

model EmailLog {
  id        Int      @id @default(autoincrement())
  fpsId     String
  kind      String                          // "start" | "eod" | "test"
  to        String
  subject   String
  ok        Boolean
  error     String?
  sentAt    DateTime @default(now())
}
```

---

## 8. Configuration matrix — static vs env vs admin-page

| Setting | Kahan | Default / Notes |
|---|---|---|
| Govt base URL | env `EPOS_BASE_URL` | `https://epos.haryanafood.gov.in` |
| District code | env `DEFAULT_DIST_CODE` | `073` (Rohtak) |
| Default ration card no. | env `DEFAULT_SRC_NO` | **Real value sirf Railway env + local `.env` me** (repo public hai). `.env.example` me `000000000000` placeholder. |
| Site password | env `ADMIN_PASSWORD` | — (set at deploy) |
| Cron shared secret | env `CRON_SECRET` | — (random) |
| Resend API key | env `RESEND_API_KEY` | FlowTrack wala reuse ya naya banaao (Resend dashboard, 10 sec) |
| Email sender | env `EMAIL_FROM` | `onboarding@resend.dev` |
| DB connection | env `DATABASE_URL` | Railway Postgres auto-inject |
| Timezone | env `TZ` | `Asia/Kolkata` |
| **Monitored FPS list** | **admin page → DB** | empty (tu add karega) |
| **Notification emails** | **admin page → DB** | `harshit9466@gmail.com` seed |
| **Shop hours / EOD time / interval** | **admin page → DB** | 05:00 / 14:00 / 21:00 |
| Current month/year (all APIs) | frontend, **auto** | aaj ka; user picker se badal sakta |

---

## 9. Auth

- `src/middleware.ts` — har request pe HTTP Basic check against `ADMIN_PASSWORD`
  (username kuch bhi, ya fixed `admin`).
- `/api/cron/poll` — Basic auth se **exempt**, iske badle `Authorization: Bearer {CRON_SECRET}` check.
- Koi login page / session / user table nahi. Personal app.

---

## 10. GitHub plan

- Repo: **`harshit9466/haryana-ration-dashboard`** — **already created** (empty).
  URL: `https://github.com/harshit9466/haryana-ration-dashboard`
- ⚠️ Abhi **PUBLIC** hai. Recommendation: **private karo** —
  `gh repo edit harshit9466/haryana-ration-dashboard --visibility private`
  Code me koi sensitive data commit nahi hoga (card number env me, `.env` gitignored), par
  public repo = koi bhi dekh sakta hai app kaise govt API scrape karta hai. Teri call.
- Commit messages: normal, **koi `Co-Authored-By` / Claude line nahi** (per teri global pref).
- `.gitignore`: `node_modules`, `.next`, `.env*`, `*.log`.
- `.env.example` commit hoga (sirf placeholders — real card number nahi).
- Git commands tujhe **code block me** dunga — tu khud run karega, main direct nahi chalaunga.

---

## 11. Railway deployment plan (MCP se)

**Ek project, do services, ek database** — sab ek hi GitHub repo se:

| Service | Kya | Start command | Notes |
|---|---|---|---|
| `web` | Next.js app | `next start` (standalone) | Public domain milega. Always-on. |
| `cron` | Poll trigger | `node scripts/cron-poll.mjs` | Railway **cron schedule** `*/15 * * * *`. Har run: `/api/cron/poll` hit karo, exit. |
| `Postgres` | Railway plugin | — | `DATABASE_URL` dono services me inject. |

**`web` service env vars:** `EPOS_BASE_URL`, `DEFAULT_DIST_CODE`, `DEFAULT_SRC_NO`, `ADMIN_PASSWORD`,
`CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `DATABASE_URL` (auto), `TZ=Asia/Kolkata`
**`cron` service env vars:** `CRON_SECRET` (same), `WEB_URL` (web ka internal/public URL)

**Steps (MCP `railway` tools se):**
1. `create-project` → "haryana-ration-dashboard"
2. Add **PostgreSQL** database
3. Create service `web` ← GitHub repo connect, root `/`
4. Set `web` env vars (upar wali list)
5. Create service `cron` ← same repo, custom start command, cron schedule set
6. Set `cron` env vars (`CRON_SECRET`, `WEB_URL`)
7. Deploy `web` → `prisma migrate deploy` release-command me
8. `generate-domain` for `web`
9. Smoke test: dashboard khule, dealer list load ho, ek FPS ka stock aaye
10. Admin page pe apni FPS add kar, "send test email" dabaa

**Deploy trigger:** GitHub `main` pe push → Railway auto-build (dono services).

---

## 12. Build phases

| Phase | Deliverable | "Done" jab |
|---|---|---|
| **0** | Repo scaffold — Next.js + TS + Tailwind + Prisma + `.env.example` + README | `npm run dev` chale, localhost khule |
| **1** | `lib/epos.ts` + `lib/normalize.ts` + proxy routes for **API 5, 2, 3, 4** | curl se saare 4 sahi normalized JSON dein |
| **2** | Dashboard UI — FPS picker (master list) + month/year + 3 tabs (Stock / Date-wise / All Txns) | ek FPS select karke teenो views dikhein |
| **3** | Card lookup — API 7 captcha box + API 6 beneficiary + 4 result cards | tera card + captcha se members/entitlement dikhe |
| **4** | DB + admin page — MonitorConfig CRUD + `mailer.ts` + test-email | admin page se FPS add ho, test mail aaye |
| **5** | `monitor.ts` + `/api/cron/poll` + `scripts/cron-poll.mjs` | local pe manually trigger karke start/EOD mail aaye |
| **6** | Auth middleware + polish + error/empty/loading states | poori site password ke peeche, koi crash nahi |
| **7** | GitHub push + Railway deploy (2 services + Postgres) via MCP | live URL pe sab kaam kare |

---

## 13. Risks / open items

| # | Item | Plan |
|---|---|---|
| R1 | APIs 2–7 ko `JSESSIONID` cookie chahiye? (sirf API 1 me dikhi thi) | Phase 1 me test. Chahiye to `lib/epos.ts` me ek cookie-jar / session-warm-up call (`GET /` pe JSESSIONID le lo) add kar denge. |
| R2 | Govt captcha `salt` session-bound hai? (cookie + salt dono match hone chahiye?) | Phase 3 me test — agar bound hai to captcha + beneficiary call **same** proxy session me chalayenge (server-side cookie forward). |
| R3 | Govt API rate-limit / block | Polling gentle rakhenge (15 min, sirf teri FPS, off-hours skip). Proper `User-Agent`. Retry with backoff. |
| R4 | API 4 response bada (sample 1 MB pe truncate hua tha) | Server-side hi filter/aggregate karke chhota payload frontend ko bhejenge. |
| R5 | ~~API 1 response missing~~ **Resolved** — API 1 HTML `<option>` deta hai | Proxy regex-parse karega. API 5 primary master rahega. |
| R6 | Railway cron ka minimum interval | 15 min chosen — safe. Agar Railway aur strict ho to web service me hi `node-cron` fallback. |
| R7 | Govt site ka SSL / IP change (`103.195.218.9`) | Hostname use karenge, IP nahi. |
| R8 | ToS — govt data personal use | Public transparency portal, low volume, personal dashboard. Data redistribute nahi kar rahe. |
| R9 | Resend shared sender sirf account-owner email pe bhejta hai | Monitor waise bhi sirf Harshit ko mail karta hai. Dusre recipient chahiye → domain verify. |
| R10 | Repo abhi **public** hai | Section 10 — private karne ki recommendation. Harshit decide karega. |

---

## 14. Decisions locked

| Decision | Value |
|---|---|
| Stack | Next.js 14 + TS + Tailwind + Prisma + Postgres |
| Email | Resend (`onboarding@resend.dev`), FlowTrack account reuse |
| Repo | `harshit9466/haryana-ration-dashboard` (created; visibility TBD) |
| Deploy | Railway — `web` + `cron` + Postgres, MCP se |
| Master list | API 5 (Dealer Details) |
| History/snapshots | **Nahi** — sirf monitor config + daily flags DB me |

## 15. Next step

Plan final hai. **"Haan, shuru karo"** bol → Phase 0 (scaffold). Har phase ke baad dikhaunga.
GitHub push + Railway deploy Phase 7 me.
