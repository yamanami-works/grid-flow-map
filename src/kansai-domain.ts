import type {RegionalSnapshot} from './regions.ts';
import {alignCapacities} from './capacity-aliases.ts';
// OCCTO関西の行を地図の線へ対応させる表（tools/prep/adopt-kansai.mjs が docs/research/kansai-occto-pairs.json に出力）。
// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]。名称・電圧・両端がそろう行だけを使う（東京と同じ規則）。
import {pairs} from './kansai-pairs.ts';
// 実績と容量で表記が違う線名（関西は2026-10-01時点でなし）
const NAME_ALIAS:Record<string,string>={};
// OCCTOの実績の符号の点検（北陸と同じ仕組み）。関西は該当なし：関西電力送配電の系統潮流実績（2025年度、8760時間）と潮流正方向・符号の傾向が一致（2026-10-02確認）
export const SIGN_CHECKS:{line:string;voltageKV:number;node:string;why:string}[]=[];
/** 節点（発電設備のない変電所）の日平均の受け入れ（MW） */
function nodeIntake(lines:{from:string;to:string;values:(number|null)[]}[],node:string){
 const inc=lines.filter(l=>l.from===node||l.to===node);if(!inc.length)return null;let sum=0,n=0;
 for(let i=0;i<inc[0].values.length;i++){let s=0,ok=true;for(const l of inc){const v=l.values[i];if(v==null){ok=false;break;}s+=l.to===node?v:-v;}if(ok){sum+=s;n++;}}
 return n?sum/n:null;
}
export function needsSignFlip(lines:{name:string;voltageKV:number;from:string;to:string;values:(number|null)[]}[],check:{line:string;voltageKV:number;node:string}){
 const target=lines.find(l=>l.name===check.line&&l.voltageKV===check.voltageKV);if(!target)return false;
 const asIs=nodeIntake(lines,check.node),flipped=nodeIntake(lines.map(l=>l===target?{...l,values:l.values.map(v=>v==null?v:-v)}:l),check.node);
 return asIs!=null&&flipped!=null&&asIs<-200&&flipped>=-200;
}
// 西大阪小曽根線＋北豊中線（OCCTOでは3変電所あての合計の1行）を、地図の十字の4区間に分ける（2026-10-06、tools/prep/adopt-holds-west.mjs）。
// 西大阪～分岐点はOCCTOの値そのまま。分岐後はOCCTOに公表がないので、関西電力送配電の予想潮流（空容量一覧 No.74 小曽根 -49・No.75 北豊中 -73・No.76 下穂積 -36 MW、2026-09-30更新）の比で按分した推定値。
const CROSS_ROW='西大阪小曽根線+北豊中線';
const CROSS_TRUNK='北豊中線・西大阪小曽根線';
const CROSS_BRANCHES:[string,string,number][]=[['西大阪小曽根線・小曽根支線','小曽根変電所',49],['北豊中線','北豊中変電所',73],['下穂積支線','下穂積変電所',36]];
type FlowRow={id:string;name:string;voltageKV:number;from:string;to:string;note:string;values:(number|null)[]};
export function splitCross<L extends FlowRow>(l:L):L[]|null{
 if(l.name.normalize('NFKC').replace(/\s/g,'')!==CROSS_ROW||l.voltageKV!==275||l.from!=='西大阪変電所')return null;
 const total=CROSS_BRANCHES.reduce((s,b)=>s+b[2],0);
 return [{...l,id:l.id+'-trunk',name:CROSS_TRUNK,from:'西大阪変電所',to:'分岐点',note:'OCCTOの「西大阪小曽根線＋北豊中線」（小曽根・下穂積・北豊中の3変電所あての合計）。'},
  ...CROSS_BRANCHES.map(([name,to,w])=>({...l,id:l.id+'-'+to,name,from:'分岐点',to,values:l.values.map(v=>v==null?v:Math.round(v*w/total)),note:`推定値：OCCTOの合計を関西電力送配電の予想潮流の比（小曽根49・北豊中73・下穂積36）で按分した（${Math.round(w/total*100)}%）。分岐後の実績は公表されていない。`}))];
}
export function reviewedKansaiDay<T extends RegionalSnapshot>(input:T):T{
 // 容量の行を実績の書き方にそろえる（src/capacity-aliases.ts、tools/build-capacity-aliases.mjs。2026-10-10）
 const day=alignCapacities('kansai',input);
 const review=(r:{name:string;voltageKV:number;from:string;to:string})=>{
  const name=r.name.normalize('NFKC'),p=pairs.find(p=>p[0].normalize('NFKC')===(NAME_ALIAS[name]??name)&&p[2]===r.voltageKV);if(!p)return null;
  if(r.from===p[3]&&r.to===p[4])return {...r,name:p[1],from:p[5],to:p[6]};
  if(r.from===p[4]&&r.to===p[3])return {...r,name:p[1],from:p[6],to:p[5]};return null;
 };
 const reviewed=day.actual.lines.flatMap(l=>{const x=splitCross(l);if(x)return x;const r=review(l);return r?[{...l,...r}]:[];});
 const flips=SIGN_CHECKS.filter(c=>needsSignFlip(reviewed,c));
 const lines=reviewed.map(l=>{const c=flips.find(c=>c.line===l.name&&c.voltageKV===l.voltageKV);return c?{...l,values:l.values.map((v:number|null)=>v==null?v:-v),note:(l.note?l.note+' ':'')+c.why}:l;});
 // OCCTO関西の運用容量は両端が1つの欄（「北摂変電所⇒西播変電所」）で「至」がない。分けてから照合する（2026-10-09 見つけた不具合：関西の容量が全部漏れて使用率が不明だった）
 const split=(c:T['capacities'][number])=>!c.to&&/⇒/.test(c.from??'')?{...c,from:c.from.split('⇒')[0].trim(),to:c.from.split('⇒').slice(1).join('⇒').trim()}:c;
 return {...day,actual:{...day.actual,lines},capacities:day.capacities.map(split).flatMap(c=>{const r=review(c);return r?[{...c,...r}]:[];})};
}
