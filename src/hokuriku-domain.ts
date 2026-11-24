import type {RegionalSnapshot} from './regions.ts';
import {alignCapacities} from './capacity-aliases.ts';
// OCCTO北陸の行を地図の線へ対応させる表（tools/prep/adopt-hokuriku.mjs が docs/research/hokuriku-occto-pairs.json に出力）。
// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]。名称・電圧・両端がそろう行だけを使う（東京と同じ規則）。
import {pairs} from './hokuriku-pairs.ts';
// 実績と容量で表記が違う線名（北陸は2026-10-01時点でなし）
const NAME_ALIAS:Record<string,string>={};
// OCCTOの実績の符号が北陸電力送配電の定義と逆になっている行の補正（2026-10-02確認）。固定で反転せず、日ごとに隣の変電所の収支で判定する。
// 敦賀火力線：北陸電力送配電の予想潮流一覧は「南条→敦賀火力」を正として予想−1124MW（敦賀火力から送り出す）。OCCTO実績は同じ表記で、
// 2026-09-01〜10-02の32日すべて終日正（約+400〜+1150MW）。そのままだと南条変電所（発電設備なし）から日平均1300〜2000MWが湧き出す収支になり、
// 反転すると南条は日平均150〜330MWの受け入れで整合する。北陸電力送配電の系統潮流実績（FY2023、8780時間）も同じ表記で平均−722MW・97%が負（敦賀火力から送り出す）。OCCTOが直した日は「そのまま」の収支が成り立つので反転しない。
export const SIGN_CHECKS:{line:string;voltageKV:number;node:string;why:string}[]=[
 {line:'敦賀火力線',voltageKV:275,node:'南条変電所',why:'OCCTOの実績値は北陸電力送配電の潮流方向の定義（南条→敦賀火力が正）と符号が逆のため、符号を反転して表示。この日の南条変電所の収支で判定（そのままでは発電設備のない南条から電気が湧き出す）。2026-09-01〜10-02は毎日逆。北陸電力送配電の系統潮流実績（2023年度）も同じ表記で97%が負（敦賀火力から送り出す）。'},
];
/** 節点（発電設備のない変電所）の日平均の受け入れ（MW）。線の向き（from→to）と値の符号で集計 */
function nodeIntake(lines:{from:string;to:string;values:(number|null)[]}[],node:string){
 const inc=lines.filter(l=>l.from===node||l.to===node);if(!inc.length)return null;let sum=0,n=0;
 for(let i=0;i<inc[0].values.length;i++){let s=0,ok=true;for(const l of inc){const v=l.values[i];if(v==null){ok=false;break;}s+=l.to===node?v:-v;}if(ok){sum+=s;n++;}}
 return n?sum/n:null;
}
/** 判定：そのままでは節点から200MW以上湧き出し、反転すると湧き出さない日だけ反転 */
export function needsSignFlip(lines:{name:string;voltageKV:number;from:string;to:string;values:(number|null)[]}[],check:{line:string;voltageKV:number;node:string}){
 const target=lines.find(l=>l.name===check.line&&l.voltageKV===check.voltageKV);if(!target)return false;
 const asIs=nodeIntake(lines,check.node),flipped=nodeIntake(lines.map(l=>l===target?{...l,values:l.values.map(v=>v==null?v:-v)}:l),check.node);
 return asIs!=null&&flipped!=null&&asIs<-200&&flipped>=-200;
}
export function reviewedHokurikuDay<T extends RegionalSnapshot>(input:T):T{
 // 分母に使わない容量の行に excluded を付ける（src/capacity-aliases.ts。「（他社）」の行など、2026-10-10）
 const day=alignCapacities('hokuriku',input);
 const review=(r:{name:string;voltageKV:number;from:string;to:string})=>{
  const name=r.name.normalize('NFKC'),p=pairs.find(p=>p[0].normalize('NFKC')===(NAME_ALIAS[name]??name)&&p[2]===r.voltageKV);if(!p)return null;
  if(r.from===p[3]&&r.to===p[4])return {...r,name:p[1],from:p[5],to:p[6]};
  if(r.from===p[4]&&r.to===p[3])return {...r,name:p[1],from:p[6],to:p[5]};return null;
 };
 const reviewed=day.actual.lines.flatMap(l=>{const r=review(l);return r?[{...l,...r}]:[];});
 const flips=SIGN_CHECKS.filter(c=>needsSignFlip(reviewed,c));
 const lines=reviewed.map(l=>{const c=flips.find(c=>c.line===l.name&&c.voltageKV===l.voltageKV);return c?{...l,values:l.values.map((v:number|null)=>v==null?v:-v),note:(l.note?l.note+' ':'')+c.why}:l;});
 return {...day,actual:{...day.actual,lines},capacities:day.capacities.flatMap(c=>{const r=review(c);return r?[{...c,...r}]:[];})};
}
