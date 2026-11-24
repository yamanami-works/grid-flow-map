import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {annotateEvidence,CONNECTION_GUESS} from '../src/evidence.ts';
const read=(f:string)=>JSON.parse(readFileSync(`public/data/${f}.json`,'utf8')).lines;
test('evidence tiers: D only for straight lines whose two ends are confirmed; inferred branch points are separate (関西42T/17T, 中国の分岐点, 富岡線, 広島中央線)',()=>{
 const k=annotateEvidence(read('kansai-trunk')),c=annotateEvidence(read('chugoku-trunk')),t=annotateEvidence(read('tokyo-trunk'));
 for(const n of ['北神線（北摂～４２Ｔ）','北神線（４２Ｔ～神戸）','西大阪東支線'])assert.ok(k.find((l:any)=>l.name===n).inferred?.length,n);
 for(const n of ['南山口支線','広島中央線'])assert.ok(c.find((l:any)=>l.name===n).inferred?.length,n);
 // 2026-10-25（保留16）：北尾道連絡線の起点は御調開閉所（一次資料に名前、位置はオーナー確認）になり、推測の分岐点ではなくなった
 assert.ok(!c.find((l:any)=>l.name==='北尾道連絡線').inferred?.length);
 const hc=c.find((l:any)=>l.name==='広島中央線');assert.equal(hc.evidenceTier,'C');assert.ok(hc.schematic);
 assert.ok(t.find((l:any)=>l.name==='富岡線（推定）').inferred?.length);
 for(const f of ['tohoku-trunk-osm','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'])for(const l of annotateEvidence(read(f)))if(l.evidenceTier==='D')assert.ok(l.connections?.every((e:any)=>e.facilities?.length)||/#\d+/.test(l.name+JSON.stringify(l.attributes)),f+' '+l.name);
 const kd=k.filter((l:any)=>l.evidenceTier==='D');assert.ok(kd.every((l:any)=>!l.inferred));
 // 2026-10-06 西大阪の十字（分岐点を推定した直線）は D ではなく C＋推測
 const cross=k.filter((l:any)=>l.id.startsWith('kansai-275-西大阪十字-'));assert.equal(cross.length,4);for(const l of cross){assert.equal(l.evidenceTier,'C');assert.ok(l.inferred?.length,l.name);}
});
test('否定の文（「〜接続は推定しない」など）は推測にしない。肯定の文は推測のまま（2026-10-18 オーナー承認）',()=>{
 for(const s of ['経路の途中で他の設備区画を通過。途中の設備との電気的接続は推定しない。','本線側との電気的分岐は推定しない。','途中の設備との接続は推定していない。','分岐の位置は推定せず、端点だけを使う。','接続は推定しません。','接続は推定されない。','推定しない。分岐の位置は公表資料による。'])assert.equal(CONNECTION_GUESS.test(s),false,s);
 for(const s of ['分岐点は最寄りの点と推定。','推定した分岐点','共有ノードを接続点とみなした。'])assert.equal(CONNECTION_GUESS.test(s),true,s);
 // 間に語が入る否定（「推定はしない」）は対象外で、今は推測と判定される
 assert.equal(CONNECTION_GUESS.test('途中の設備との接続の推定はしない。'),true);
 const t=annotateEvidence(read('tokyo-trunk'));for(const id of ['tokyo-section-21','tokyo-section-83','tokyo-section-91','tokyo-section-100','tokyo-section-132','tokyo-section-134'])assert.ok(!t.find((l:any)=>l.id===id).inferred,id);
});
