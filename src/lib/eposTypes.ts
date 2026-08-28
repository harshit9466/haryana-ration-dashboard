/**
 * Government ePOS API ke types.
 *  - `Raw*`  = jaise govt bhejta hai (jitne fields hum use karte hain)
 *  - baaki   = normalized shape jo humari proxy routes frontend ko deti hain
 *
 * Govt numeric fields kabhi number, kabhi { source, parsedValue } — isliye `unknown`,
 * normalize karte waqt `num()` se guzaarte hain.
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
  commodityColumns: string[]; // saari commodities jo kisi bhi din bikin — table headers
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
