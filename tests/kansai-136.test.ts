// 保留136（2026-11-19 オーナー回答「(a)は②、(b)は推奨、(c)は②」）：南姫路・飾磨港・高砂変電所、高砂の発電所、No.52、No.39・43 の付け替え（scripts/kansai-136.mjs）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';
const read=(f:string)=>JSON.parse(readFileSync('public/data/'+f,'utf8'));
const k=read('kansai-trunk.json'),L=(id:string)=>k.lines.find((x:any)=>x.id===id),F=(id:string)=>k.facilities.find((x:any)=>x.id===id);
const ends=(l:any)=>l.connections.map((c:any)=>c.facilities[0]?.name??c.status);
test('変電所3つと発電所2つ',()=>{
 for(const [id,name] of [['kansai-place-高砂変電所','高砂変電所'],['osm-way-367261471','南姫路変電所'],['osm-way-798162366','飾磨港変電所']]){const f=F(id);assert.equal(f.name,name);assert.equal(f.kind,'substation');assert.deepEqual(f.voltages,[275,77]);
  assert.ok(f.attributes.some((a:any)=>a.label==='要注意（位置推定）'),name);assert.match(f.attributes.find((a:any)=>a.label==='名称の確認').value,/2026年11月17日更新/);}
 assert.equal(F('osm-way-1093999564').name,'実証設備複合サイクル発電所（三菱重工）');assert.equal(F('osm-way-969601128').name,'神鋼加古川発電所');
 assert.match(F('osm-way-969601128').attributes.find((a:any)=>a.label==='系統との接続').value,/高砂変電所に直接つながるとみなした（推測/);
 assert.match(F('osm-way-605382256').attributes.find((a:any)=>a.label==='系統との接続').value,/高砂変電所に直接つながるとみなした（推測/);
 assert.match(F('osm-way-367261461').attributes.find((a:any)=>a.label==='系統との接続').value,/南姫路変電所に直接つながるとみなした（推測/);
});
test('No.52・43・39・37・40 の両端',()=>{
 assert.deepEqual([L('kansai-275-way-1580889887').name,...ends(L('kansai-275-way-1580889887'))],['送電線（No.52）（推定）','実証設備複合サイクル発電所（三菱重工）','高砂変電所']);
 assert.deepEqual([L('kansai-plant-275-way-605382256').name,...ends(L('kansai-plant-275-way-605382256'))],['送電線（No.43）（推定）','高砂変電所','新加古川変電所']);
 assert.deepEqual([L('kansai-plant-275-way-367261461').name,...ends(L('kansai-plant-275-way-367261461'))],['送電線（No.39）（推定）','南姫路変電所','新加古川変電所']);
 for(const id of ['kansai-275-gsi-姫路第二接続','ledger-infer-kansai-275-185027449'])assert.equal(ends(L(id))[0],'南姫路変電所');
 // 姫路第二・高砂火力・神鋼加古川で終わる線はない（直接つながるとみなした推測）
 for(const id of ['osm-way-367261461','osm-way-605382256','osm-way-969601128'])assert.ok(!k.lines.some((l:any)=>l.connections.some((c:any)=>c.facilities.some((f:any)=>f.id===id))),id);
 for(const id of ['kansai-275-way-1580889887','kansai-plant-275-way-605382256','kansai-plant-275-way-367261461']){assert.equal(evidenceOf(L(id)).tier,'C');assert.ok(evidenceOf(L(id)).inferred.length>0,id);}
 const u=read('undrawn-sections.json');const rows=u.rows??Object.values(u).find(Array.isArray);for(const no of ['39','43','52'])assert.ok(!rows.some((r:any)=>r.region==='kansai'&&r.no===no),no);
});
