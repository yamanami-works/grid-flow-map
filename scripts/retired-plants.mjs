// 廃止発電所を設備と電源線に反映する（2026-10-09 オーナー指示）。一覧は docs/research/retired-plants.json（tools/prep/build-retired-plants.mjs）。
// - 発電所：status「廃止」、廃止時期（retiredAt）、根拠（statusSource）。2025年以降で各社の公表がないものは statusConfirmed:false と注記。
// - 電源線：消さない（公表表に載っていないことは廃止の根拠にならない）。公表区間でない線は運用状態「未確認」（statusConfirmed:false＋statusCheck）。
//   撤去・廃止の一次資料が見つかった線だけ、builder で除いて tests/baseline/approved-removals.json に登録する。
import {readFileSync,existsSync} from 'node:fs';
const FILE='docs/research/retired-plants.json';
const published=l=>(l.attributes??[]).some(a=>/^公表区間|^公表の行|^公表の線名/.test(a.label));
export function applyRetiredPlants(lines,facilities){
 if(!existsSync(FILE))return 0;
 const list=JSON.parse(readFileSync(FILE,'utf8')).plants;let n=0;
 for(const f of facilities){const r=list[f.id];if(!r||f.kind!=='plant')continue;
  Object.assign(f,{status:'廃止',retiredAt:r.retiredAt,...(r.retiredAtNote?{retiredAtNote:r.retiredAtNote}:{}),statusConfirmed:r.confirmed,statusSource:`${r.basis}（${r.retiredAtNote??'廃止時期'} ${r.retiredAt}）。${r.sources.join(' ')}`});n++;}
 for(const l of lines){if(l.id.startsWith('tie-')||published(l))continue;
  const p=(l.connections??[]).flatMap(c=>c.facilities).map(x=>facilities.find(f=>f.id===x.id)).find(f=>f?.kind==='plant'&&f.status==='廃止');
  if(!p)continue;
  l.statusConfirmed=false;
  l.statusCheck=`接続先の${p.name}は廃止${p.retiredAt?'（'+p.retiredAt+'）':''}。この線の撤去・転用・運用状態は一次資料で確認できていない（OSMの登録のまま表示）。`;}
 return n;
}
