import type {RegionalSnapshot} from './regions.ts';
import {alignCapacities} from './capacity-aliases.ts';
// OCCTO中国の行を地図の線へ対応させる表（tools/prep/adopt-chugoku.mjs が docs/research/chugoku-occto-pairs.json に出力）。
// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]。名称・電圧・両端がそろう行だけを使う（東京と同じ規則）。
import {pairs} from './chugoku-pairs.ts';
// 実績と容量で表記が違う線名（中国は2026-10-01時点でなし）
const NAME_ALIAS:Record<string,string>={};
// OCCTOの実績の符号の点検（北陸と同じ仕組み）。中国は該当なし：中国電力ネットワークの系統潮流実績（2025年度）と潮流正方向・符号の傾向が全29行で一致（2026-10-02確認）
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
// 運用容量の行を実績の行の書き方へそろえる（2026-11-09）。新岩国連絡線は実績の起点が線名（「新岩国連絡線→新岩国（変）」）、
// 運用容量の起点が新西広島（変）で、同じ照合表の行に合わない。名前・電圧・両端が完全に一致する行だけを読み替える（src/capacity-aliases.ts の
// 一般の規則とは別の、この1行だけの例外。根拠は OCCTO の運用容量の表と中国電力ネットワーク 系統空容量 No.基L21 の両端）
const SAME_ROW_ENDS:{name:string;voltageKV:number;from:string;to:string;asFrom:string}[]=[
 {name:'新岩国連絡線',voltageKV:220,from:'新西広島（変）',to:'新岩国（変）',asFrom:'新岩国連絡線'},
];
function sameRowEnds<T extends {name:string;voltageKV:number;from:string;to:string}>(r:T):T{
 const m=SAME_ROW_ENDS.find(x=>x.name===r.name.normalize('NFKC')&&x.voltageKV===r.voltageKV&&x.from===r.from&&x.to===r.to);
 return m?{...r,from:m.asFrom}:r;
}
export function reviewedChugokuDay<T extends RegionalSnapshot>(input:T):T{
 // 分母に使わない容量の行に excluded を付ける（src/capacity-aliases.ts。「（他社）」の行など、2026-10-10）
 const day=alignCapacities('chugoku',input);
 const review=(r0:{name:string;voltageKV:number;from:string;to:string})=>{
  const r=sameRowEnds(r0);
  const name=r.name.normalize('NFKC'),p=pairs.find(p=>p[0].normalize('NFKC')===(NAME_ALIAS[name]??name)&&p[2]===r.voltageKV);if(!p)return null;
  if(r.from===p[3]&&r.to===p[4])return {...r,name:p[1],from:p[5],to:p[6]};
  if(r.from===p[4]&&r.to===p[3])return {...r,name:p[1],from:p[6],to:p[5]};return null;
 };
 const reviewed=day.actual.lines.flatMap(l=>{const r=review(l);return r?[{...l,...r}]:[];});
 const flips=SIGN_CHECKS.filter(c=>needsSignFlip(reviewed,c));
 const lines=reviewed.map(l=>{const c=flips.find(c=>c.line===l.name&&c.voltageKV===l.voltageKV);return c?{...l,values:l.values.map((v:number|null)=>v==null?v:-v),note:(l.note?l.note+' ':'')+c.why}:l;});
 return {...day,actual:{...day.actual,lines},capacities:day.capacities.flatMap(c=>{const r=review(c);return r?[{...c,...r}]:[];})};
}
