import type {RegionalSnapshot} from './regions.ts';
import {alignCapacities} from './capacity-aliases.ts';
// OCCTO中部の行を地図の線へ対応させる表（tools/prep/adopt-chubu.mjs が docs/research/chubu-occto-pairs.json に出力）。
// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]。名称・電圧・両端がそろう行だけを使う（東京と同じ規則）。
import {pairs} from './chubu-pairs.ts';
// 実績と容量で表記が違う線名（OCCTO中部 2026-10-01：実績「岐阜連絡」・容量「岐阜連絡線」）
const NAME_ALIAS:Record<string,string>={'岐阜連絡線':'岐阜連絡'};
export function reviewedChubuDay<T extends RegionalSnapshot>(input:T):T{
 // 分母に使わない容量の行に excluded を付ける（src/capacity-aliases.ts。「（他社）」の行など、2026-10-10）
 const day=alignCapacities('chubu',input);
 const review=(r:{name:string;voltageKV:number;from:string;to:string})=>{
  const name=r.name.normalize('NFKC'),p=pairs.find(p=>p[0].normalize('NFKC')===(NAME_ALIAS[name]??name)&&p[2]===r.voltageKV);if(!p)return null;
  if(r.from===p[3]&&r.to===p[4])return {...r,name:p[1],from:p[5],to:p[6]};
  if(r.from===p[4]&&r.to===p[3])return {...r,name:p[1],from:p[6],to:p[5]};return null;
 };
 return {...day,actual:{...day.actual,lines:day.actual.lines.flatMap(l=>{const r=review(l);return r?[{...l,...r}]:[];})},capacities:day.capacities.flatMap(c=>{const r=review(c);return r?[{...c,...r}]:[];})};
}
