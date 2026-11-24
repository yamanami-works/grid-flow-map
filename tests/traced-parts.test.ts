import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {osmFillCounts} from '../src/real-domain.ts';
// 2026-11-06 保留79（オーナー回答「(a) 8本全部」）：国土地理院の送電線記号・航空写真でなぞった区間（tracedParts）は「直線補完」と分けて数える
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const files=readdirSync('public/data').filter(f=>/-trunk\.json$|^hokkaido-hokuto\.json$|^tohoku-dc-osm\.json$/.test(f));
// 2026-11-07 保留84：飛騨信濃直流幹線の6区間を足した（当時 9件の記録・延べ18区間）
test('なぞった区間（tracedParts）は25件の記録・延べ35区間だけで、整合がとれている',()=>{
 const recs:string[]=[];let n=0;
 for(const f of files)for(const l of read('public/data/'+f).lines??[]){if(!l.tracedParts)continue;recs.push(f+':'+l.name);n+=l.tracedParts.length;
  for(const t of l.tracedParts){assert.ok(t.osmId<0&&l.osmIds.includes(t.osmId),l.name);assert.ok(!(l.schematicParts??[]).some((s:any)=>s.osmId===t.osmId),l.name);assert.ok(t.basis,l.name);}}
 // 2026-11-09（保留98）：中国の新岩国連絡線を国土地理院の送電線記号でなぞった（1件・1区間）ので 9件・18区間 → 10件・19区間
 // 2026-11-10（保留102）：中国の新成羽川発電所の電源線を国土地理院の送電線記号でなぞった（1件・1区間）ので 11件・20区間
 // 2026-11-10（保留104）：中国の新倉敷連絡線・井原連絡線の交差部を国土地理院の送電線記号でつないだ（2件・2区間）ので 13件・22区間
 // 2026-11-17（保留124）：東京の大鳥・大津岐への引込線と新野田への引込線の末端を国土地理院の送電線記号でなぞった（3件・3区間）ので 16件・25区間
 // 2026-11-17（保留127 K2）：中東京幹線の2本の信濃川側を国土地理院の送電線記号でなぞり、移した信濃川変電所まで延ばした（2件・2区間）ので 18件・27区間
 // 2026-11-18（保留128-5、オーナー指示 2026-11-17）：関西の東播支線を、西神戸線の分岐点（推定）から東播変電所まで国土地理院の送電線記号でなぞって描き直した（1件・1区間）ので 19件・28区間
 // 2026-11-19（保留134、オーナー指示「小坂川発電所の電源線は地理院地図からたどって、高根馬瀬線に接続して。」）：中部の小坂川発電所の電源線を国土地理院の送電線記号でなぞった（1件・1区間）ので 20件・29区間
 // 2026-11-19（保留135、オーナー回答「図のとおり進めて」）：関西の姫路まわりで、No.41・No.40・No.37 を国土地理院の送電線記号でなぞり（3件・3区間）、No.36 の P30→新加古川を新加古川線と同じ OSM の点で描いた（1件・2区間）ので 24件・34区間
 // 2026-11-22（保留146、回答「すべて推奨で」）：関西の飾磨港線（推定、No.35）を国土地理院の送電線記号でなぞった（1件・1区間）ので 25件・35区間
 assert.equal(recs.length,25,recs.join(' '));assert.equal(n,35);
});
test('詳細パネルの数：なぞった区間は直線補完に数えない',()=>{
 const line=(f:string,name:string)=>read('public/data/'+f).lines.find((l:any)=>l.name===name);
 assert.deepEqual(osmFillCounts(line('tokyo-trunk.json','相馬双葉幹線')),{straight:0,traced:1,bases:['Google マップ航空写真の鉄塔']});
 assert.deepEqual(osmFillCounts(line('kyushu-trunk.json','日向幹線')),{straight:1,traced:2,bases:['国土地理院の送電線記号']});
 assert.deepEqual(osmFillCounts(line('chugoku-trunk.json','広島東幹線（新広島～三原開閉所）')),{straight:3,traced:3,bases:['国土地理院の送電線記号']});
 assert.deepEqual(osmFillCounts(line('tokyo-trunk.json','飛騨信濃直流幹線')),{straight:0,traced:6,bases:['国土地理院の送電線記号']});
 // なぞった区間のない線は今までどおり（負の仮IDはすべて直線補完）
 const tk=line('tokyo-trunk.json','東新宿線（ルート不明・直線）');assert.deepEqual(osmFillCounts(tk),{straight:tk.osmIds.filter((i:number)=>i<0).length,traced:0,bases:[]});
});
