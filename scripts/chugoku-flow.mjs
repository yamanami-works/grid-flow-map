import {hokkaidoSnapshot} from './hokkaido-flow.mjs';
// Parser reuse only; Chugoku IDs/attribution are separate. No cross-region observations.
export function chugokuSnapshot(actual,capacity,date,retrievedAt){
 const d=hokkaidoSnapshot(actual,capacity,date,retrievedAt);
 return {...d,attribution:'出典：OCCTO系統情報サービス（中国）。区間照合・参考使用率は本アプリで加工。',actual:{...d.actual,lines:d.actual.lines.map(l=>({...l,id:l.id.replace(/^hk-/,'cg-'),note:'OCCTO中国公表実績。区間別に照合。'}))},capacities:d.capacities.map(c=>({...c,id:c.id.replace(/^hk-/,'cg-')}))};
}
