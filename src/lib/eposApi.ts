import { eposGet, eposPost } from "@/lib/epos";
import { cached, TTL } from "@/lib/cache";
import {
  num,
  str,
  eposDateToIso,
  parseEposDateTime,
  parseFpsOptions,
} from "@/lib/normalize";
import type {
  Contact,
  Dealer,
  DealersResult,
  FpsOption,
  RawDateWiseResponse,
  RawDealersResponse,
  RawStockRow,
  RawTransaction,
  StockResult,
  StockRow,
  DateWiseResult,
  TransactionsResult,
  Transaction,
  CommodityQty,
  Captcha,
  RawCaptcha,
  BeneficiaryResult,
  RawBeneficiaryResponse,
} from "@/lib/eposTypes";

// Govt endpoint paths — ek jagah, taaki typo na ho.
const PATHS = {
  fpsList: "/Epos_Spring/Common/getFPSs",
  stockRegister: "/Epos_Spring/fps/getfpsStockregister",
  dateWise: "/Epos_Spring/fps/dateWiseTransDetails",
  transactions: "/Epos_Spring/fps/fpstransactionwitoutcatptcha",
  dealers: "/Epos_Spring/api/fpsdevicemapping/device",
  captcha: "/Epos_Spring/captcha/captcha-image",
  beneficiary: "/Epos_Spring/sdms/SRC_Trans_Int",
} as const;

function contact(name: unknown, mobile: unknown): Contact | null {
  const n = str(name);
  const m = str(mobile);
  if (!n && !m) {
    return null;
  }
  return { name: n, mobile: m };
}

// ── API 5: Dealer Details (master list, cached) ─────────────────────
export async function getDealers(distCode: string): Promise<DealersResult> {
  return cached(`dealers:${distCode}`, TTL.oneDay, async () => {
    // ⚠️ Ye endpoint form-encoded chahta hai — JSON bheja to govt 500 deta hai.
    const raw = await eposPost<RawDealersResponse>(
      PATHS.dealers,
      { dist_code: distCode },
      { encode: "form" },
    );
    const list = Array.isArray(raw?.list) ? raw.list : [];
    const dealers: Dealer[] = list
      .filter((d) => str(d.fps_id))
      .map((d) => ({
        fpsId: str(d.fps_id),
        dealerName: str(d.del_name),
        dealerMobile: str(d.del_mob),
        terminalId: str(d.terminal_id),
        nominee1: contact(d.nom_1_name, d.nom_1_mob),
        nominee2: contact(d.nom_2_name, d.nom_2_mob),
      }))
      .sort((a, b) => a.fpsId.localeCompare(b.fpsId));

    return {
      district: str(raw?.dist_name_en) || distCode,
      distCode,
      count: dealers.length,
      dealers,
    };
  });
}

// ── API 1: FPS list (HTML, cached) ─────────────────────────────────
export async function getFpsOptions(
  distCode: string,
  afsoCode: string,
): Promise<FpsOption[]> {
  return cached(`fpslist:${distCode}:${afsoCode}`, TTL.oneDay, async () => {
    const html = await eposGet<string>(
      PATHS.fpsList,
      { dist_code: distCode, afso_code: afsoCode },
      "text",
    );
    return parseFpsOptions(html);
  });
}

// ── API 2: FPS Stock Register ──────────────────────────────────────
export async function getStockRegister(
  fpsId: string,
  month: number,
  year: number,
): Promise<StockResult> {
  const raw = await eposPost<RawStockRow[]>(PATHS.stockRegister, {
    fps_id: fpsId,
    month: String(month),
    year: String(year),
  });
  const list = Array.isArray(raw) ? raw : [];

  const rows: StockRow[] = list.map((r) => ({
    commodityId: str(r.commId),
    commodity: str(r.commNameEn),
    unit: str(r.commMeasureUnit),
    allotted: num(r.allottedQty),
    opening: num(r.ob),
    received: num(r.receivedQty),
    extraRo: num(r.extraRo),
    sixaCase: num(r.sixaCase),
    issued: num(r.issuedQty),
    closing: num(r.cb),
  }));

  const first = list[0] ?? {};
  return {
    fpsId,
    district: str(first.distNameEn),
    afso: str(first.afso_name_en),
    month,
    year,
    refreshedAt: str(first.refreshTime),
    rows,
  };
}

// ── API 3: Date-wise Transactions ─────────────────────────────────
export async function getDateWiseTransactions(
  fpsId: string,
  distCode: string,
  month: number,
  year: number,
): Promise<DateWiseResult> {
  const raw = await eposPost<RawDateWiseResponse>(PATHS.dateWise, {
    dist_code: distCode,
    fps_id: fpsId,
    month: String(month),
    year: String(year),
  });

  const dayList = Array.isArray(raw?.dateWiseList) ? raw.dateWiseList : [];
  const columns = new Set<string>();

  const days = dayList.map((d) => {
    const commodities: CommodityQty[] = (d.commoditylist ?? [])
      .map((c) => {
        const name = str(c.comm_short) || str(c.comm_name_en);
        const qty = num(c.sale_qty);
        if (name) {
          columns.add(name);
        }
        return { commodityId: Number(c.comm_id ?? 0), commodity: name, qty };
      })
      .filter((c) => c.commodity);

    return {
      date: str(d.date),
      isoDate: eposDateToIso(d.date),
      cards: num(d.avilcards),
      commodities,
      totalQty: commodities.reduce((sum, c) => sum + c.qty, 0),
    };
  });

  return {
    fpsId,
    heading: str(raw?.heading),
    monthName: str(raw?.monthname),
    year: Number(raw?.year ?? year),
    commodityColumns: [...columns],
    days,
  };
}

// ── API 4: FPS-wise Transactions ─────────────────────────────────
/**
 * @param dateIso  optional "YYYY-MM-DD" — sirf us din ki transactions (govt poora
 *                 mahina deta hai, ek shop ka 1000+ ho sakta hai). Aggregates
 *                 filtered set pe hi bante hain.
 */
export async function getFpsTransactions(
  fpsId: string,
  month: number,
  year: number,
  dateIso?: string,
): Promise<TransactionsResult> {
  const raw = await eposPost<RawTransaction[]>(PATHS.transactions, {
    fps_id: fpsId,
    month: String(month),
    year: String(year),
  });
  let list = Array.isArray(raw) ? raw : [];
  if (dateIso) {
    list = list.filter((t) => str(t.loginTime).startsWith(dateIso));
  }

  const transactions: Transaction[] = list.map((t) => {
    const commodities: CommodityQty[] = (t.commodityList ?? [])
      .map((c) => ({
        commodityId: Number(c.comm_id ?? 0),
        commodity: str(c.comm_name_en) || str(c.comm_short),
        qty: num(c.sale_qty),
      }))
      .filter((c) => c.commodity);

    const at = parseEposDateTime(t.loginTime);

    return {
      rc: str(t.existingRcNumber),
      status: str(t.transStatus),
      scheme: str(t.schemeShortName),
      receiptId: str(t.receiptId),
      txnId: str(t.txnId),
      authAt: str(t.portCheck),
      amount: num(t.amount),
      durationSec: num(t.transTime),
      at: at ? at.toISOString() : null,
      loginTime: str(t.loginTime),
      authType: str(t.auth_type),
      commodities,
    };
  });

  // Aggregates — dashboard + monitor dono use karenge.
  const byCommodityMap = new Map<string, number>();
  const byDateMap = new Map<string, number>();
  let totalAmount = 0;

  for (const t of transactions) {
    totalAmount += t.amount;
    const iso = t.loginTime.slice(0, 10);
    if (iso) {
      byDateMap.set(iso, (byDateMap.get(iso) ?? 0) + 1);
    }
    for (const c of t.commodities) {
      byCommodityMap.set(
        c.commodity,
        (byCommodityMap.get(c.commodity) ?? 0) + c.qty,
      );
    }
  }

  return {
    fpsId,
    month,
    year,
    dateIso: dateIso ?? null,
    count: transactions.length,
    totalAmount,
    byCommodity: [...byCommodityMap].map(([commodity, qty]) => ({
      commodityId: 0,
      commodity,
      qty,
    })),
    byDate: [...byDateMap]
      .map(([isoDate, count]) => ({ isoDate, count }))
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
    // Poora mahina (koi date filter nahi) → row-list bhaari hoti hai, sirf
    // aggregates bhejte hain. Ek din ki maangi ho → us din ki saari rows.
    transactions: dateIso ? transactions : [],
  };
}

// ── API 7: Captcha image ───────────────────────────────────────────
export async function getCaptcha(): Promise<Captcha> {
  const raw = await eposGet<RawCaptcha>(PATHS.captcha, { t: Date.now() });
  const image = str(raw?.image);
  return {
    imageDataUri: image ? `data:image/jpeg;base64,${image}` : "",
    salt: str(raw?.salt),
  };
}

// ── API 6: Beneficiary (ration card) details ──────────────────────
export async function getBeneficiary(
  srcNo: string,
  month: number,
  year: number,
  captcha: string,
  salt: string,
): Promise<BeneficiaryResult> {
  const raw = await eposPost<RawBeneficiaryResponse>(
    PATHS.beneficiary,
    {
      src_no: srcNo,
      month: String(month),
      year: String(year),
      captcha,
      salt,
    },
    { allow4xx: true }, // galat captcha → govt 400 { responseMessage: "Captcha Invalid" }
  );

  if (str(raw?.respcode) !== "200") {
    return {
      ok: false,
      rc: srcNo,
      message:
        str(raw?.responseMessage) ||
        str(raw?.respmsg) ||
        "Couldn't fetch beneficiary details (wrong captcha or card number).",
    };
  }

  const members = (raw.beneficaryMemberList ?? []).map((m) => ({
    memberId: str(m.member_id),
    name: str(m.member_name_en),
    mobile: str(m.mob_no),
    active: str(m.active).toLowerCase() === "active",
    gender: str(m.gender_type_gt_type_id),
    age: num(m.member_age),
    scheme: str(m.scheme_short_name),
    kycUid: str(m.kyc_uid),
    fpsId: str(m.fps_id),
  }));

  const entitlements = (raw.benficaryEntitlementList ?? []).map((e) => ({
    commodity: str(e.comm_name_eng),
    unit: str(e.unit_type),
    allocated: num(e.allocation_qty),
    balance: num(e.bal_quantity_entitled),
    month: str(e.month_short_name),
  }));

  const authentications = (raw.benficaryAuthenticationsList ?? []).map((a) => ({
    fpsId: str(a.fps_id),
    authType: str(a.auth_type),
    responseCode: str(a.response_code),
    result: str(a.error_desc),
    member: str(a.member_name_en),
    date: str(a.auth_time),
  }));

  const transactions = (raw.benficaryTransList ?? []).map((t) => ({
    status: str(t.trans_status),
    fpsId: str(t.port_fpsid),
    member: str(t.availed_member_name),
    date: str(t.avail_date),
    commodities: (t.commoditylist ?? [])
      .map((c) => ({
        commodityId: Number(c.comm_id ?? 0),
        commodity: str(c.comm_short) || str(c.comm_name_en),
        qty: num(c.sale_qty) || num(c.allot_qty),
      }))
      .filter((c) => c.commodity),
  }));

  return {
    ok: true,
    rc: srcNo,
    members,
    entitlementHeading: str(raw.benficaryEntitlementHeading),
    entitlements,
    authHeading: str(raw.benficaryAuthenticationHeading),
    authentications,
    txnHeading: str(raw.benficaryTranscationHeading),
    transactions,
  };
}
