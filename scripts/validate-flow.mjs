// 観測値の大きさの上限（2026-11-02 セキュリティレビュー E、オーナー回答「推奨で」＝全国一律）：絶対値が 10,000 MW を超えたら失敗。
// docs/RULES.md 5節「データの検証：…値の範囲」。2026-11-02 時点の全10データの最大は約 5,500 MW。運用容量の値には当てない
export const MAX_MW=10000;
export function validateFlowDays(days){
 if(!Array.isArray(days)||!days.length||days.length>30)throw Error('Invalid history length');
 const dates=new Set();
 for(const d of days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||dates.has(d.date))throw Error('Invalid or duplicate date');dates.add(d.date);
  if(d.actual?.times.length!==48||!d.actual.lines.length||!Array.isArray(d.capacities))throw Error('Incomplete flow day');
  if(d.actual.times.some((t,i)=>t!==`${d.date}T${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}:00`))throw Error('Invalid half-hour grid');
  const keys=new Set();
  for(const l of d.actual.lines){const key=l.id;if(keys.has(key))throw Error('Duplicate observation');keys.add(key);if(l.values.length!==48||l.values.some(v=>v!==null&&!Number.isFinite(v)))throw Error('Invalid observation values');if(l.values.some(v=>v!==null&&Math.abs(v)>MAX_MW))throw Error('Observation out of range: '+key);}
 }
}
