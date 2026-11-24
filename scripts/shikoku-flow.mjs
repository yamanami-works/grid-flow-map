import {hokkaidoSnapshot} from './hokkaido-flow.mjs';
// Parser reuse only; Shikoku IDs/attribution are separate. No cross-region observations.
export function shikokuSnapshot(actual,capacity,date,retrievedAt){
 const d=hokkaidoSnapshot(actual,capacity,date,retrievedAt);
 return {...d,attribution:'出典：OCCTO系統情報サービス（四国）。区間照合・参考使用率は本アプリで加工。',actual:{...d.actual,lines:d.actual.lines.map(l=>({...l,id:l.id.replace(/^hk-/,'sk-'),note:'OCCTO四国公表実績。区間別に照合。'}))},capacities:d.capacities.map(c=>({...c,id:c.id.replace(/^hk-/,'sk-')}))};
}
