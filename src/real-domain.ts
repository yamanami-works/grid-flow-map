import {trunkDisplay} from './display-settings.ts';
/** 線・設備の運用状態（2026-10-03）。'廃止' は設備（発電所等）だけに使う。線は線自体の運用状態で判定する。 */
export type AssetStatus = '運用中' | '建設中' | '計画中' | '廃止';
export interface AssetStatusInfo {
  /** 未設定のデータは読み込み時に '運用中' を既定値として入れ、statusConfirmed=false で区別する（src/asset-status.ts）。 */
  status?: AssetStatus;
  statusConfirmed?: boolean;
  /** 建設中・計画中の使用開始予定（例「2027年1月」） */
  plannedStart?: string;
  /** 状態の根拠（出典） */
  statusSource?: string;
  /** 廃止の時期（YYYY-MM-DD。発電所だけ。docs/research/retired-plants.json） */
  retiredAt?: string;
  /** 廃止時期の日付の意味（例「廃止措置計画の認可日」「最後のユニットの稼働終了日（HJKS）」） */
  retiredAtNote?: string;
  /** 運用状態を一次資料で確認できていないときの注記（表示は「要確認」） */
  statusCheck?: string;
}
/** 照合の確からしさ（docs/EVIDENCE_TIERS.md）。D は「両端が公表資料で確定し、経路だけ不明な直線」。E は最低区分「補助資料のみ」（2026-10-11）。 */
export type EvidenceTier = 'A' | 'B' | 'C' | 'D' | 'E';
/** 需要家の設備・線の出典（docs/CUSTOMER_FACILITIES.md）。primary＝名前の確認に使える一次資料（需要家・一般送配電会社・OCCTO・行政・メーカー技報）、auxiliary＝補助資料（OSM・報道・Wikipedia等）。
 *  namesFacility：その資料が当該設備を名指ししているか。result：一次資料を検索した結果（見つかった／見つからない）。 */
export interface CustomerSource { kind: 'primary' | 'auxiliary'; category: string; name: string; url?: string; checkedAt?: string; namesFacility?: boolean; result?: string }
/** 需要家（基幹系統で受電する需要家の設備。2026-10-11、docs/CUSTOMER_FACILITIES.md） */
export interface CustomerInfo {
  /** 画面に出す名前。一次資料で確認できた正式名か「需要家」 */
  displayName: string;
  /** 正式名（一次資料で確認できたものだけ） */
  officialName?: string;
  // 補助資料上の名称（OSMなど）は配信データに入れない：docs/research/customer-aux-names.json（2026-10-13）
  industry?: string; owner?: string;
  /** 受電電圧（kV） */
  receivingKV: number[];
  /** 名前の確認状況 */
  nameStatus: 'confirmed' | 'unconfirmed';
  sources: CustomerSource[];
}
/** 推定でつないだ接続点・分岐点（D区分の「経路不明」とは別）。point は推定した点、basis はその根拠 */
export interface InferredPoint { point: [number, number] | null; basis: string }
export interface GeoLine extends AssetStatusInfo {
  evidenceTier?: EvidenceTier;
  /** 基幹系統表示の例外（2026-10-14）：対象電圧外でも基幹系統+連系線の表示に出す線。'fc-ac-side'＝周波数変換所の交流側の接続線。正本は config/<地域>-approval.json の trunkExceptionLines（ビルドが書き写す） */
  trunkException?: 'fc-ac-side';
  /** 需要家線：需要家の設備だけに供給する区間（役割で判定。所有者は customerLine.owner）。OCCTOに行がある区間は潮流を通常どおり表示する */
  lineType?: 'customer';
  customerLine?: { owner: '需要家' | '一般送配電会社' | '未確認'; ownerBasis?: string };
  inferred?: InferredPoint[];
  referenceReview?: {status:'partial'|'section';endpoints:string};
  /** Geographic route unknown: drawn as a straight dotted line between the two published endpoint facilities (D tier). */
  schematic?: boolean;
  /** Construction of a straight line of unknown route, inferred from cables/overhead lines at both ends. */
  construction?: 'underground' | 'overhead' | 'unknown';
  /** OSM way IDs (subset of osmIds) registered as power=cable (underground); drawn dotted. */
  cableOsmIds?: number[];
  cableLabel?: string; // 点線区間の説明（既定は「地中区間あり」）。橋添架・海底ケーブルなど地中でないもの
  /** OCCTOの行名がこの線の名前と違うときの対応名（1行が複数区間・複数ルートにまたがる。東京 北千葉線・河北線など） */
  flowNames?: string[];
  /** 線の途中にある変電所（OCCTOの区間の端になる点。東京 江東線の葛南など） */
  flowTaps?: { name: string; position: [number, number] }[];
  /** 同じ鉄塔に載る別の線（共架）の線ID。経路の一部を共用して途中で分かれるが、その線の分岐ではない。OCCTOの行の「分岐」に数えない（src/flow-path.ts の flowBranches。2026-11-10）。除外は線単位なので、その行の経路の別の場所で本当に分岐する線には付けない */
  coHungWith?: string[];
  /** 選択のまとまり。同じ値の線は、どれを選んでも全部を一緒に強調する（関西 新北陸幹線 No.214 の1回線ずつの2本。2026-11-18） */
  selectGroup?: string;
  /** Straight parts of unknown route inside a line (negative synthetic osmIds), e.g. the gap from an OSM line end to its endpoint facility. */
  schematicParts?: { osmId: number; construction: 'underground' | 'overhead' | 'unknown' }[];
  /** 地図データ以外の資料（国土地理院の送電線記号・航空写真など）で経路の形をなぞった区間（負の仮ID）。直線ではない。詳細パネルで「直線補完」と分けて数える（2026-11-06） */
  tracedParts?: { osmId: number; basis: string }[];
  /** Route taken from a TSO's published map instead of OSM (e.g. 中部PG 系統空容量マッピング); osmIds are then negative synthetic IDs. */
  publishedRoute?: {label:string; url:string; retrievedAt:string; mapAsOf:string; featureNames:string[]};
  assetId?:string;
  attributes?: {label:string;value:string}[];
  id: string; name: string; voltageKV: number; paths: [number, number][][];
  osmIds: number[]; named: boolean;
  topology?: { scope?: 'same-name'; namedComponents: number; networks: { id: string; osmIds: number[]; names: string[]; terminals: {node:number; position:[number,number]; nearest?:{id:string;name:string;meters:number}}[] }[] };
  osmRefs?: string[];
  osmTimestamp?: string;
  currentType?: 'ac' | 'dc' | 'unknown';
  connectedWayIds?: number[];
  connections?: { node:number; position:[number,number]; status:'facility-area'|'shared-node'|'unresolved'; facilities:{id:string;name:string}[]; neighborWays:number[]; otherVoltages?:{id:number;power:string;voltage:string|null}[]; nearest?:{id:string;name:string;meters:number} }[];
}
export type FacilityKindAll = 'substation' | 'switchyard' | 'plant' | 'converter' | 'customer';
export interface GeoFacility extends AssetStatusInfo {
  assetId?:string;
  attributes?: {label:string;value:string}[];
  id: string; name: string; kind: FacilityKindAll; position: [number, number];
  voltages: number[]; /** OSM の区画などの出典の URL。位置推定で置いた設備（*-place-*）にはない */ url?: string;
  /** 発電所の種別（一次資料で確認したものだけ。docs/research/plant-primary-sources.json の type、scripts/plant-primary.mjs） */
  plantType?: {label: string; detail?: string; note?: string; source: string};
  scopeConnected?: boolean;
  /** Further roles of the same site (e.g. a substation that also houses a frequency converter); drawn as extra symbols. */
  alsoKinds?: FacilityKindAll[];
  /** 設備の確度を明示するとき（需要家の E など）。無ければ src/evidence.ts の facilityTierOf が属性から決める */
  evidenceTier?: EvidenceTier;
  /** 需要家の情報（kind または alsoKinds が customer のとき） */
  customer?: CustomerInfo;
}
export interface Geography {
  schemaVersion: number; coverage: string; retrievedAt: string; osmTimestamp: string;
  license: string; attribution: string; sourceUrl: string; sourceHash: string;
  lines: GeoLine[]; facilities: GeoFacility[]; excludedVoltageUnknown: number;
}
export interface ActualLine {
  id: string; name: string; voltageKV: number; from: string; to: string; note: string;
  values: (number | null)[];
}
export interface ForecastLine {
  id: string; name: string; voltageKV: number; circuitCount: number;
  equipmentMW: number | null; capacityMW: number | null; constraint: string;
  direction: string; forecastMW: number | null; note: string; published: string;
}
export interface Bank {
  id: string; name: string; primaryKV: number; secondaryKV: number;
  capacityMW: number | null; equipmentMW: number | null; bankCount: number;
  constraint: string; forecastMW: number | null; note: string; published: string;
}
export interface OfficialResearch {
  schemaVersion: number; usage: string;
  sources: Record<string, { url: string; retrievedAt: string; sha256: string }>;
  actual: { times: string[]; originalTimes: string[]; lines: ActualLine[] };
  forecast: { published: string; records: ForecastLine[] };
  substations: { published: string; records: Bank[] };
}
export function inPrototypeScope(line: { voltageKV: number; currentType?: string }) {
  return line.currentType === 'dc' ? Number.isFinite(line.voltageKV) && line.voltageKV > 7 : trunkDisplay.acVoltages.includes(line.voltageKV);
}
export function referenceStatus(id: string, lines: GeoLine[]): 'missing' | 'matching' | 'conflicting' {
  const refs = lines.flatMap(l => l.osmRefs ?? []);
  if (refs.some(ref => ref !== id)) return 'conflicting';
  return lines.length && lines.every(l => l.osmRefs?.length) ? 'matching' : 'missing';
}
// 照合の事前計算（2026-10-10 表示速度の改善）：正規化した名前は文字列ごとに1回だけ計算して保持する
const normalizedNames = new Map<string, string>();
export function normalizeName(name: string) {
  let v = normalizedNames.get(name);
  if (v === undefined) { v = name.normalize('NFKC').replace(/\s+/g, '').replace(/^東北電力(?:ネットワーク)?/, ''); normalizedNames.set(name, v); }
  return v;
}
// 設備の検索に使う名前（2026-10-18）：表示名と、属性「別名」の名前の部分（最初の「（」「(」より前。説明の部分は使わない）。
// 需要家は表示名だけ（docs/RULES.md 3節「需要家」）。設備ごとに1回だけ作る（表示名が変わったときだけ作り直す。データは読み込みごとに新しい設備オブジェクトになる前提で、属性「別名」の変更は見ない）
type SearchableFacility = { name: string; kind?: string; attributes?: { label: string; value: string }[] };
const searchNames = new WeakMap<SearchableFacility, { names: string[]; keys: string[] }>();
const searchEntry = (f: SearchableFacility) => {
  let v = searchNames.get(f);
  if (!v || v.names[0] !== f.name) {
    const aliases = f.kind === 'customer' ? [] : (f.attributes ?? []).filter(a => a.label === '別名').map(a => a.value.split(/[（(]/)[0].trim()).filter(Boolean);
    const names = [...new Set([f.name, ...aliases])];
    v = { names, keys: names.map(n => normalizeName(n).toLowerCase()) }; searchNames.set(f, v);
  }
  return v;
};
export const facilitySearchNames = (f: SearchableFacility): string[] => searchEntry(f).names;
/** 設備が検索語（normalizeName 済み）に当たるか。表示名で当たれば true、別名だけで当たればその別名、当たらなければ null。大文字と小文字は同じに扱う（設備の検索だけ） */
export function facilityQueryMatch(f: SearchableFacility, query: string): true | string | null {
  const q = query.toLowerCase(), {names, keys} = searchEntry(f);
  if (keys[0].includes(q)) return true;
  const i = keys.findIndex((k, j) => j > 0 && k.includes(q));
  return i > 0 ? names[i] : null;
}
// 「正規化名|電圧」→ 線の一覧（元の並び順）。線の配列ごとに作り、配列の長さが変わるか invalidateNameIndex（flowNames の付け替え）で作り直す
let nameIndexVersion = 0;
const nameIndexes = new WeakMap<readonly GeoLine[], { version: number; size: number; index: Map<string, GeoLine[]> }>();
export function invalidateNameIndex() { nameIndexVersion++; }
function nameIndex(lines: readonly GeoLine[]) {
  const c = nameIndexes.get(lines);
  if (c && c.version === nameIndexVersion && c.size === lines.length) return c.index;
  const index = new Map<string, GeoLine[]>();
  for (const line of lines) {
    if (!line.named) continue;
    for (const key of new Set([line.name, ...(line.flowNames ?? [])].map(n => normalizeName(n) + '|' + line.voltageKV))) { const a = index.get(key); if (a) a.push(line); else index.set(key, [line]); }
  }
  nameIndexes.set(lines, { version: nameIndexVersion, size: lines.length, index });
  return index;
}
export function candidateGeometry(record: { name: string; voltageKV: number }, lines: GeoLine[]) {
  if (lines.length > 16) return [...(nameIndex(lines).get(normalizeName(record.name) + '|' + record.voltageKV) ?? [])];
  return lines.filter(line => line.named && line.voltageKV === record.voltageKV && (normalizeName(line.name) === normalizeName(record.name) || !!line.flowNames?.some(n => normalizeName(n) === normalizeName(record.name))));
}
// 行のどれかに対応する線（連系線の表示の線を選ぶ）。行名との一致は名前のある線だけ。flowNames（tie-flow.json の lineAliases など、明示した対応）との一致は名前のない線も含める（北本直流幹線の名前のない区間。2026-11-08）。電圧の一致は必須。flowNames は一次資料などで明示した対応だけに使う（足すとこの線が連系線の表示に入りうる）
export function recordLines(lines: GeoLine[], records: readonly { name: string; voltageKV: number }[]) {
  const keys = new Set(records.map(r => normalizeName(r.name) + '|' + r.voltageKV));
  return lines.filter(l => (l.named && keys.has(normalizeName(l.name) + '|' + l.voltageKV)) || !!l.flowNames?.some(n => keys.has(normalizeName(n) + '|' + l.voltageKV)));
}
export function changedDefinition(actual: ActualLine, forecast: ForecastLine | undefined) {
  return !!forecast && (normalizeName(actual.name) !== normalizeName(forecast.name) || actual.voltageKV !== forecast.voltageKV || `${actual.from}→${actual.to}` !== forecast.direction);
}
export function forecastUsage(record: ForecastLine): number | null {
  if (record.forecastMW === null || record.capacityMW === null || record.capacityMW <= 0 || !Number.isFinite(record.forecastMW) || !Number.isFinite(record.capacityMW)) return null;
  return Math.abs(record.forecastMW) / record.capacityMW * 100;
}
// Exact name + voltage is a candidate only. No OSM direction is inferred from naming.
export function geometryCanAnimate(review: { status: string; directionVerified: boolean; validFor: string }, kind: string): boolean {
  return review.status === 'reviewed' && review.directionVerified && review.validFor === kind;
}

/** 詳細パネル「OSM 線分」の欄の数（2026-11-06）：負の仮IDのうち、なぞった区間（tracedParts）とそれ以外（直線補完）を分ける。bases はなぞった根拠（重複なし） */
export function osmFillCounts(g: {osmIds: number[]; tracedParts?: {osmId: number; basis: string}[]}): {straight: number; traced: number; bases: string[]} {
  const t = new Set((g.tracedParts ?? []).map(x => x.osmId));
  return {straight: g.osmIds.filter(i => i < 0 && !t.has(i)).length, traced: g.osmIds.filter(i => i < 0 && t.has(i)).length, bases: [...new Set((g.tracedParts ?? []).map(x => x.basis))]};
}
