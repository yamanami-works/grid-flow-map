import {hokkaidoSnapshot} from './hokkaido-flow.mjs';
// Parser reuse only; Tokyo IDs/attribution are separate. No cross-region observations.
export function tokyoSnapshot(actual,capacity,date,retrievedAt){
 const d=hokkaidoSnapshot(actual,capacity,date,retrievedAt);
 return {...d,attribution:'出典：OCCTO系統情報サービス（東京）。区間照合・参考使用率は本アプリで加工。',actual:{...d.actual,lines:d.actual.lines.map(l=>({...l,id:l.id.replace(/^hk-/,'tk-'),note:'OCCTO東京公表実績。区間別に照合。'}))},capacities:d.capacities.map(c=>({...c,id:c.id.replace(/^hk-/,'tk-')}))};
}
