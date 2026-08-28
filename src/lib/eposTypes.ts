/**
 * Types for the government ePOS API.
 *  - `Raw*`  = the shape the government sends (only the fields we use)
 *  - the rest = the normalized shape our proxy routes return to the frontend
 *
 * Government numeric fields are sometimes a number, sometimes { source, parsedValue },
 * hence `unknown` — run them through `num()` when normalizing.
 */

export type EposNum = unknown;

// ── API 5: Dealer Details (master list) ──────────────────────────────
export type RawDealer = {
  dist_code?: string;
  dist_name_en?: string;
  fps_id?: string;
  terminal_id?: string;
  del_name?: string;
  del_mob?: string;
  nom_1_name?: string;
  nom_1_mob?: string;
  nom_2_name?: string;
  nom_2_mob?: string;
};

export type RawDealersResponse = {
  dist_name_en?: string;
  list_size?: number;
  list?: RawDealer[];
};

export type Contact = { name: string; mobile: string };

export type Dealer = {
  fpsId: string;
  dealerName: string;
  dealerMobile: string;
  terminalId: string;
  nominee1: Contact | null;
  nominee2: Contact | null;
};

export type DealersResult = {
  district: string;
  distCode: string;
  count: number;
  dealers: Dealer[];
};

// ── API 1: FPS list (HTML <option> tags) ─────────────────────────────
export type FpsOption = { fpsId: string; dealerName: string };

// ── API 2: FPS Stock Register ───────────────────────────────────────
export type RawStockRow = {
  distNameEn?: string;
  distCode?: string;
  afso_name_en?: string;
  afsoCode?: string;
  fpsId?: string;
  commNameEn?: string;
  commId?: string;
  commMeasureUnit?: string;
  allottedQty?: EposNum;
  ob?: EposNum;
  receivedQty?: EposNum;
  extraRo?: EposNum;
  sixaCase?: EposNum;
  issuedQty?: EposNum;
  cb?: EposNum;
  refreshTime?: string;
};

export type StockRow = {
  commodityId: string;
  commodity: string;
  unit: string;
  allotted: number;
  opening: number;
  received: number;
  extraRo: number;
  sixaCase: number;
  issued: number;
  closing: number;
};

export type StockResult = {
  fpsId: string;
  district: string;
  afso: string;
  month: number;
  year: number;
  refreshedAt: string;
  rows: StockRow[];
};

// ── API 3: Date-wise Transactions ───────────────────────────────────
export type RawDateWiseCommodity = {
  comm_id?: number;
  comm_short?: string;
  comm_name_en?: string | null;
  sale_qty?: EposNum;
  statesaleQty?: EposNum;
  nfsasaleQty?: EposNum;
  allot_qty?: EposNum; // present in API 6 beneficiary transactions
};

export type RawDateWiseDay = {
  date?: string;
  avilcards?: string;
  commoditylist?: RawDateWiseCommodity[];
};

export type RawDateWiseResponse = {
  respcode?: string;
  respmsg?: string;
  heading?: string;
  monthname?: string;
  year?: number;
  dateWiseList?: RawDateWiseDay[];
};

export type CommodityQty = {
  commodityId: number;
  commodity: string;
  qty: number;
};

export type DateWiseDay = {
  date: string; // "DD-MM-YYYY" (govt format)
  isoDate: string; // "YYYY-MM-DD"
  cards: number;
  commodities: CommodityQty[];
  totalQty: number;
};

export type DateWiseResult = {
  fpsId: string;
  heading: string;
  monthName: string;
  year: number;
  commodityColumns: string[]; // every commodity sold on any day — table headers
  days: DateWiseDay[];
};

// ── API 4: FPS-wise Transactions ────────────────────────────────────
export type RawTxnCommodity = {
  comm_id?: number;
  comm_name_en?: string | null;
  comm_short?: string | null;
  sale_qty?: EposNum;
};

export type RawTransaction = {
  existingRcNumber?: string;
  transStatus?: string;
  schemeShortName?: string;
  schemeId?: string;
  receiptId?: string;
  txnId?: string;
  portCheck?: string;
  amount?: string;
  transTime?: string;
  loginTime?: string;
  auth_type?: string;
  commodityList?: RawTxnCommodity[];
};

export type Transaction = {
  rc: string;
  status: string;
  scheme: string;
  receiptId: string;
  txnId: string;
  authAt: string; // portCheck: "Self" ya doosri fps_id
  amount: number;
  durationSec: number;
  at: string | null; // ISO timestamp (loginTime, IST → UTC)
  loginTime: string; // raw "YYYY-MM-DD HH:mm:ss"
  authType: string;
  commodities: CommodityQty[];
};

export type TransactionsResult = {
  fpsId: string;
  month: number;
  year: number;
  dateIso: string | null;
  count: number;
  totalAmount: number;
  byCommodity: CommodityQty[];
  byDate: { isoDate: string; count: number }[];
  transactions: Transaction[];
};

// ── API 7: Captcha image ───────────────────────────────────────────
export type RawCaptcha = { image?: string; salt?: string };
export type Captcha = {
  /** data URI — <img src> me seedha lagta hai */
  imageDataUri: string;
  salt: string;
};

// ── API 6: Beneficiary (ration card) details ──────────────────────
// ⚠️ The government field names contain typos (beneficary / benficary) — match them as-is.
export type RawBeneficiaryMember = {
  member_id?: string;
  rc_id?: string;
  member_name_en?: string;
  mob_no?: string;
  active?: string;
  scheme_short_name?: string;
  fps_id?: string;
  gender_type_gt_type_id?: string;
  dist_name_en?: string;
  afso_name_en?: string;
  kyc_uid?: string;
  member_age?: number;
};

export type RawEntitlement = {
  comm_name_eng?: string;
  unit_type?: string;
  allocation_qty?: string;
  bal_quantity_entitled?: string;
  month_short_name?: string;
};

export type RawAuthentication = {
  fps_id?: string;
  auth_type?: string;
  response_code?: string;
  error_desc?: string;
  member_name_en?: string;
  auth_time?: string;
  total?: number;
};

export type RawBeneficiaryTxn = {
  trans_status?: string;
  port_fpsid?: string;
  availed_member_name?: string;
  avail_date?: string;
  commoditylist?: RawDateWiseCommodity[];
};

export type RawBeneficiaryResponse = {
  respcode?: string;
  respmsg?: string;
  responseMessage?: string; // error path (e.g. "Captcha Invalid")
  beneficaryMemberList?: RawBeneficiaryMember[];
  benficaryEntitlementHeading?: string;
  benficaryEntitlementList?: RawEntitlement[];
  benficaryAuthenticationHeading?: string;
  benficaryAuthenticationsList?: RawAuthentication[];
  benficaryTranscationHeading?: string;
  benficaryTransList?: RawBeneficiaryTxn[];
};

export type BeneficiaryMember = {
  memberId: string;
  name: string;
  mobile: string;
  active: boolean;
  gender: string;
  age: number;
  scheme: string;
  kycUid: string;
  fpsId: string;
};

export type Entitlement = {
  commodity: string;
  unit: string;
  allocated: number;
  balance: number;
  month: string;
};

export type Authentication = {
  fpsId: string;
  authType: string;
  responseCode: string;
  result: string;
  member: string;
  date: string;
};

export type BeneficiaryTxn = {
  status: string;
  fpsId: string;
  member: string;
  date: string;
  commodities: CommodityQty[];
};

export type BeneficiaryResult =
  | {
      ok: true;
      rc: string;
      members: BeneficiaryMember[];
      entitlementHeading: string;
      entitlements: Entitlement[];
      authHeading: string;
      authentications: Authentication[];
      txnHeading: string;
      transactions: BeneficiaryTxn[];
    }
  | { ok: false; rc: string; message: string };
