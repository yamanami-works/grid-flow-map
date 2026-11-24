// 発電所の「種別」カード（2026-10-10、docs/mockups/detail-panel/README.md「発電所の種別」）。
// 値は一次資料で確認したものだけ：①一次資料の一覧（docs/research/plant-primary-sources.json の type → 設備の plantType）
// ②事業者の資料（public/data/plant-profiles.json の method）③HJKS のユニット別の発電形式。OSMのタグ・名前・地図のマークからは推定しない。
// 大分類だけ分かり形式・炉型・燃料の細区分が不明なものは partial（点線の枠＋「…未確認」）。何もなければ unknown（「未確認」）。
export type PlantTypeLine = {label: string; partial: boolean; missing?: string};
export type PlantTypeView = {lines: PlantTypeLine[]; sub: string[]; partial: boolean; unknown: boolean; unitLabels: Record<string, string>};
export type PlantTypeInput = {
  primary?: {label: string; detail?: string; note?: string} | null;
  profileMethod?: string | null;
  units?: {unit: string; format: string | null; status: string}[];
};
const REACTOR: [RegExp, string][] = [[/ABWR/, '改良型沸騰水型軽水炉'], [/(^|[^A])BWR/, '沸騰水型軽水炉'], [/PWR/, '加圧水型軽水炉'], [/GCR/, '黒鉛減速炭酸ガス冷却炉']];
const MISSING = {hydro: '形式（水路式・ダム式・揚水）', nuclear: '炉型（BWR・ABWR・PWR）', gas: '汽力・コンバインドサイクルの別', thermal: '燃料'};
/** HJKS の発電形式（火力（ガス）など）→ 種別の行。「その他」・空欄は null（照合しない） */
export function fromHjks(format: string | null | undefined): PlantTypeLine | null {
  switch (format) {
    case '火力（石炭）': return {label: '石炭', partial: false};
    case '火力（石油）': return {label: '石油', partial: false};
    case '火力（ガス）': return {label: 'ガス', partial: true, missing: MISSING.gas};
    case '原子力': return {label: '原子力', partial: true, missing: MISSING.nuclear};
    case '水力': return {label: '水力', partial: true, missing: MISSING.hydro};
    default: return null;
  }
}
/** 一次資料・事業者の資料の書き方 → 種別の行 */
export function fromLabel(text: string | null | undefined): PlantTypeLine | null {
  const t = String(text ?? '').trim();
  if (!t || t === '未確認') return null;
  const map: Record<string, PlantTypeLine> = {
    '石炭火力': {label: '石炭', partial: false},
    '揚水式水力': {label: '水力（揚水）', partial: false},
    'LNGコンバインドサイクル': {label: 'LNG（コンバインドサイクル）', partial: false},
    'LNG火力': {label: 'LNG', partial: true, missing: MISSING.gas},
    'ガス': {label: 'ガス', partial: true, missing: MISSING.gas},
    '原子力': {label: '原子力', partial: true, missing: MISSING.nuclear},
    '水力': {label: '水力', partial: true, missing: MISSING.hydro},
    '火力': {label: '火力', partial: true, missing: MISSING.thermal},
  };
  return map[t] ?? {label: t, partial: false};
}
export const majorOf = (label: string) => /原子力/.test(label) ? '原子力' : /水力|揚水/.test(label) ? '水力' : /石炭|石油|重油|ガス|LNG|バイオマス|火力/.test(label) ? '火力' : 'その他';
const fuelOf = (label: string) => /石炭/.test(label) ? '石炭' : /石油|重油/.test(label) ? '石油' : /ガス|LNG/.test(label) ? 'ガス' : null;

export function plantTypeView(input: PlantTypeInput): PlantTypeView {
  const units = input.units ?? [];
  // 運転中のユニットがあればそれだけで決める（廃止済みの発電所は全ユニット）
  const live = units.some(u => u.status === '運転中') ? units.filter(u => u.status === '運転中') : units;
  const unitLines = live.map(u => ({unit: u.unit, line: fromHjks(u.format)})).filter((x): x is {unit: string; line: PlantTypeLine} => !!x.line);
  const hjks = [...new Map(unitLines.map(x => [x.line.label, x.line])).values()];
  const specific = fromLabel(input.primary?.label) ?? fromLabel(input.profileMethod);
  // 具体的な一次資料の値が HJKS と大分類（火力なら燃料も）で食い違わなければそれを使う。食い違えば HJKS（ユニット別）を使う
  const agrees = (s: PlantTypeLine) => hjks.length > 0 && hjks.every(h => majorOf(h.label) === majorOf(s.label) && (majorOf(s.label) !== '火力' || !fuelOf(s.label) || fuelOf(h.label) === fuelOf(s.label)));
  // 一次資料・事業者の資料が燃料のない「火力」だけで、HJKS が1種類の火力（燃料あり）なら HJKS を使う（2026-10-19。広野・秋田で燃料が出なかった）。
  // 一次資料に detail・note があるときは説明が消えるので替えない
  const genericThermal = specific?.label === '火力' && !input.primary?.detail && !input.primary?.note && hjks.length === 1 && majorOf(hjks[0].label) === '火力';
  const useSpecific = !!specific && !genericThermal && (hjks.length === 0 || (hjks.length === 1 && agrees(specific)));
  const lines = useSpecific ? [specific!] : hjks;
  const sub: string[] = [];
  // 号機で炉型が違う発電所（「原子力（BWR・ABWR）」など）は、書かれた炉型をすべて書かれた順に出す（2026-10-18）
  for (const l of lines) for (const m of l.label.matchAll(/ABWR|BWR|PWR|GCR/g)) { const hit = REACTOR.find(([re]) => re.test(m[0])); if (hit) sub.push(hit[1]); }
  if (useSpecific && input.primary) { if (input.primary.detail) sub.push(input.primary.detail); if (input.primary.note) sub.push(input.primary.note); }
  if (lines.length > 1) sub.push('号機ごとの種別は設備出力の内訳を参照');
  for (const l of lines) if (l.partial && l.missing) sub.push(`${l.missing}未確認`);
  const unitLabels: Record<string, string> = {};
  if (!useSpecific && hjks.length > 1) for (const x of unitLines) unitLabels[x.unit] = x.line.label;
  return {lines, sub: [...new Set(sub)], partial: lines.some(l => l.partial), unknown: !lines.length, unitLabels};
}
