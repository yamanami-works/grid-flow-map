// 詳細パネルの号機の内訳（2026-11-10）。HJKS の号機に、HJKS にない号機（廃止措置中・建設中、src/plant-extra-units.ts）を足す。
// - 番号で照合する（全角数字は半角にそろえる）。HJKS に同じ番号の号機があれば足さない
// - HJKS の号機名「単独」は、HJKS の発電所名に号機の番号があればその番号で出す（例「島根原子力発電所第２号機」→「2号機」）
// 合計（運転中の号機）と種別カードには使わない（呼び出し側で HJKS の号機だけを渡す）
import type {PlantExtraUnit} from './plant-extra-units';
export type UnitView = {name: string; mw: number; start: string | null; end: string | null; status: string; extra?: boolean};
type HjksUnit = {unit: string; mw: number; start: string | null; end: string | null; status: string; plant: string};
const unitNo = (s: string) => s.normalize('NFKC').match(/(\d+)\s*号/)?.[1] ?? null;
export function hjksUnitName(u: {unit: string; plant: string}): string {
  if (u.unit !== '単独') return u.unit;
  const n = unitNo(u.plant); return n ? n + '号機' : u.unit;
}
export function mergeUnits(hjks: HjksUnit[], extra: PlantExtraUnit[] = []): UnitView[] {
  const list: UnitView[] = hjks.map(u => ({name: hjksUnitName(u), mw: u.mw, start: u.start, end: u.end, status: u.status}));
  const have = new Set(hjks.flatMap(u => [unitNo(u.unit), unitNo(u.plant)]).filter(Boolean));
  for (const x of extra) { const n = unitNo(x.name); if (n && have.has(n)) continue; list.push({name: x.name, mw: x.mw, start: x.start, end: null, status: x.status, extra: true}); }
  return list;
}
