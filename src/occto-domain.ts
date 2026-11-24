// 使用率＝OCCTOの行の潮流 ÷ 同じ行の運用容量（OCCTO 運用容量・対象断面「実績」・対象年月日の値。1日1つ、時間帯の区分はない）。
// 潮流と同じ向きの運用容量を使う。OCCTOは1行につき公表上の正方向の1方向しか載せないので、逆潮流は正方向の運用容量で算出し reverse:true（参考）とする（2026-10-10）。
// 運用容量がない・0のときは usage:null。設備容量・熱容量での代用はしない。負の値で公表されたときは絶対値で算出した参考値（2026-11-04。符号の意味・向きの対応は未確認）。
// capacityState（2026-10-10）：'zero'＝運用容量0（停止中の可能性。表示は容量不明と同じ、2026-11-04）、'negative'＝負の値で公表（OCCTOの項目説明に符号の意味の記載なし。使用率は絶対値で算出し、capacityMW は公表値（負）のまま）、
//   'none'＝容量の行がない・99999以上（設定なしを表す値。全エリア共通で分母に使わない）・分母に使わない行（excluded）。灰色の「不明」は none と zero（zero は 2026-11-04 から地図で同じ表示。パネルは「未確認 運用容量 0 MW」＋注意）。
// 連系線は時刻別（30分値）の運用容量 capacityValues を持つ。timeIndex を渡すとその時刻の値を分母にする（2026-10-10）。
type Cap = {name:string;voltageKV:number;from:string;to:string;capacityMW:number|null;constraint?:string;capacityValues?:(number|null)[];excluded?:string;capacityRetrievedAt?:string};
export type CapacityState = 'ok'|'zero'|'negative'|'none';
export type UsageInfo = {usage:number|null;capacityMW:number|null;reverse:boolean;from:string;to:string;capacityState:CapacityState;constraint?:string;timed?:boolean;excluded?:string;capacityRetrievedAt?:string};
/** 99999MW 以上は「設定なし」を表す値として扱う */
export const CAPACITY_UNSET_MW = 99999;
// 容量の行を「線名|電圧」で引く索引（容量の配列ごとに1回作る。2026-10-10 表示速度の改善）
const capIndexes = new WeakMap<readonly Cap[], Map<string, Cap[]>>();
const capIndex = (capacities: readonly Cap[]) => { let m = capIndexes.get(capacities); if (!m) { m = new Map(); for (const c of capacities) { const k = c.name + '|' + c.voltageKV, a = m.get(k); if (a) a.push(c); else m.set(k, [c]); } capIndexes.set(capacities, m); } return m; };
export function capacityUsageInfo(record: {name:string;voltageKV:number;from:string;to:string}, mw:number, capacities:Cap[], timeIndex?:number): UsageInfo {
 const from=mw<0?record.to:record.from,to=mw<0?record.from:record.to;
 const none:UsageInfo={usage:null,capacityMW:null,reverse:false,from,to,capacityState:'none'};
 if(!Number.isFinite(mw))return none;
 let excluded:string|undefined;
 const pick=(a:string,b:string)=>{
  const all=(capIndex(capacities).get(record.name+'|'+record.voltageKV)??[]).filter(c=>c.from===a&&c.to===b),m=all.filter(c=>!c.excluded);
  if(!m.length&&all.length)excluded??=all[0].excluded;
  if(m.length!==1)return undefined;
  const c=m[0],timed=!!c.capacityValues&&timeIndex!=null&&timeIndex>=0,v=timed?c.capacityValues![timeIndex!]??null:c.capacityMW;
  return v!=null&&v>=CAPACITY_UNSET_MW?undefined:{v,constraint:c.constraint,timed,keptAt:c.capacityRetrievedAt};
 };
 // keptAt：その日の後の取得で未公表だったため残した運用容量の取得時刻（2026-10-30）
 const extra=(c:{constraint?:string;timed:boolean;keptAt?:string})=>({...(c.constraint?{constraint:c.constraint}:{}),...(c.timed?{timed:true}:{}),...(c.keptAt?{capacityRetrievedAt:c.keptAt}:{})});
 const bad=(c:{v:number|null;constraint?:string;timed:boolean;keptAt?:string},reverse:boolean):UsageInfo=>c.v==null||!Number.isFinite(c.v)?{...none,...extra(c)}:{...none,capacityMW:c.v,reverse,...(c.v<0?{usage:Math.abs(mw)/Math.abs(c.v)*100}:{}),capacityState:c.v===0?'zero':'negative',...extra(c)};
 const ok=(c:number|null):c is number=>c!=null&&Number.isFinite(c)&&c>0;
 const same=pick(from,to);
 if(same)return ok(same.v)?{usage:Math.abs(mw)/same.v*100,capacityMW:same.v,reverse:false,from,to,capacityState:'ok',...extra(same)}:bad(same,false);
 const rev=pick(to,from);
 if(rev&&ok(rev.v))return {usage:Math.abs(mw)/rev.v*100,capacityMW:rev.v,reverse:true,from,to,capacityState:'ok',...extra(rev)};
 return rev?bad(rev,true):excluded?{...none,excluded}:none;
}
/** 同じ向きの運用容量だけで算出する厳密な使用率（逆向きの容量は借りない）。画面は capacityUsageInfo を使い、逆潮流を「参考」として区別する */
export function capacityReferenceUsage(record: {name:string;voltageKV:number;from:string;to:string}, mw:number, capacities:Cap[], timeIndex?:number) {
 const r=capacityUsageInfo(record,mw,capacities,timeIndex);return r.reverse?null:r.usage;
}
/** 制約要因が作業による一時的な運用容量か（宮城幹線「熱容量（作業）」など） */
export const isWorkCapacity=(constraint?:string)=>!!constraint&&/作業/.test(constraint);
/** OCCTOの1行を複数の地図の線に出しているもの（連系線「西播東岡山線・山崎智頭線」の2線合計など）。同じ日の、値の並びが同じで線名が違う行を束ねる */
export function combinedRowGroups(lines:{name:string;values:(number|null)[]}[]):string[][]{
 const by=new Map<string,Set<string>>();
 for(const l of lines){if(!l.values.some(v=>v!=null&&v!==0))continue;const k=JSON.stringify(l.values);(by.get(k)??by.set(k,new Set()).get(k)!).add(l.name);}
 return [...by.values()].filter(s=>s.size>1).map(s=>[...s]);
}
