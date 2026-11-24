// 回帰テストの基準（2026-10-03 オーナー指示7）：全国表示に入る10データの線・設備のID一覧と件数を tests/baseline/asset-ids.json に保存する。
// 意図して追加したときだけ手で実行する（node scripts/write-baseline.mjs）。減った場合は tests/baseline.test.ts と scripts/verify-build.mjs が失敗する。
// 意図的な削除は tests/baseline/approved-removals.json に {file, kind, id, reason, approvedAt} で載せたものだけ許可する。
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
// 2026-10-04：東北は tohoku-trunk-osm.json（凍結・配信なし）から tohoku-trunk.json へ。消えた線・設備は approved-removals.json に記録
export const BASELINE_FILES=['tohoku-trunk.json','tohoku-dc-osm.json','hokkaido-hokuto.json','tokyo-trunk.json','chubu-trunk.json','hokuriku-trunk.json','kansai-trunk.json','chugoku-trunk.json','shikoku-trunk.json','kyushu-trunk.json'];
export function snapshot(dir='public/data'){
 const datasets={};let lines=0,facilities=0;const L=new Set(),F=new Set();
 for(const f of BASELINE_FILES){const d=JSON.parse(readFileSync(`${dir}/${f}`,'utf8'));datasets[f]={lines:d.lines.map(x=>x.id).sort(),facilities:d.facilities.map(x=>x.id).sort()};lines+=d.lines.length;facilities+=d.facilities.length;d.lines.forEach(x=>L.add(x.id));d.facilities.forEach(x=>F.add(x.id));}
 return {counts:{lines,facilities,uniqueLines:L.size,uniqueFacilities:F.size},datasets};
}
// 基準から消えたID（承認済み削除を除く）
export function missing(base,now,approved=[]){
 const out=[];for(const [f,b] of Object.entries(base.datasets))for(const kind of ['lines','facilities']){const have=new Set(now.datasets[f]?.[kind]??[]);for(const id of b[kind])if(!have.has(id)&&!approved.some(a=>a.file===f&&a.kind===kind&&a.id===id))out.push(`${f} ${kind} ${id}`);}
 return out;
}
if(process.argv[1]?.endsWith('write-baseline.mjs')){
 const s=snapshot();writeFileSync('tests/baseline/asset-ids.json',JSON.stringify({recordedAt:new Date().toISOString().slice(0,10),...s},null,1)+'\n');
 if(!existsSync('tests/baseline/approved-removals.json'))writeFileSync('tests/baseline/approved-removals.json','[]\n');
 console.log('baseline',JSON.stringify(s.counts));
}
