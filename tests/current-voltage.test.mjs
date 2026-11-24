import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyCurrentVoltage} from '../scripts/current-voltage.mjs';
import {rawSkip,excludedSkip} from './raw-data.mjs';
import {lineWidth} from '../src/line-style.ts';import {referenceFlowPath} from '../src/flow-path.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('reviewed Asahi geometry follows the raw OSM way',{skip:rawSkip('data/raw/osm-trunk-expanded.json')},()=>{
 const g=read('public/data/tohoku-trunk-osm.json'),raw=read('data/raw/osm-trunk-expanded.json');
 const l=g.lines.find(l=>l.id==='tohoku-section-0128');
 const way=raw.elements.find(e=>e.type==='way'&&e.id===250430938);assert.equal(way.tags.voltage,'500000');
 const geo=new Set(way.geometry.map(p=>[p.lat,p.lon].join()));const part=l.paths[l.osmIds.indexOf(250430938)];assert.ok(part.length>300&&part.every(p=>geo.has(p.join())));
});
test('reviewed Asahi operating voltage preserves geometry IDs and raw source',()=>{
 const g=read('public/data/tohoku-trunk-osm.json');
 // 2026-10-01 東北の見直し：OSMの朝日幹線（way 250430938）は公表区間 No.0128 の線（tohoku-section-0128、275kV）に置き換わった。
 const l=g.lines.find(l=>l.id==='tohoku-section-0128');assert.equal(l.name,'朝日幹線');assert.equal(l.voltageKV,275);assert.ok(!g.lines.some(x=>x.id==='osm-250430938-500'));
 assert.equal(lineWidth(l.voltageKV),3.5);
 for(const p of ['data/catalog/assets.json','public/data/asset-registry.json']){const a=read(p).assets.find(a=>a.id==='asset-d177b59a-8cbe-41c2-8d61-5a33a3f45fd7');if(a)assert.deepEqual(a.voltageKV,[275]);}
 const base={id:'osm-250430938-500',name:'朝日幹線',osmIds:[250430938],voltageKV:500,attributes:[]};applyCurrentVoltage(base);
 assert.equal(base.voltageKV,275);const replay=structuredClone(base);replay.voltageKV=500;applyCurrentVoltage(replay);assert.deepEqual(replay,base);applyCurrentVoltage(replay);assert.deepEqual(replay,base);
 const other={id:'other',voltageKV:500};assert.equal(applyCurrentVoltage(other),false);assert.equal(other.voltageKV,500);
});
test('current capacity and actuals remain 275; incomplete Asahi endpoint path is not bridged',()=>{
 const g=read('public/data/tohoku-trunk-osm.json');
 const a=read('public/data/occto-tohoku.json').days.flatMap(d=>d.actual.lines).find(l=>l.name==='朝日幹線');assert.equal(a.voltageKV,275);assert.equal(referenceFlowPath(a,g.lines),null);
});
// 東北電力NW の空容量一覧は携帯用ビルドだけ（data/private/。2026-11-09 保留95 ⑤-b）。公開リポジトリの Actions では、ないときだけ飛ばす
test('current capacity rows of Asahi, Minami-Yamagata and Yamagata remain 275',{skip:excludedSkip('data/private/network-capacity.json')},()=>{
 for(const name of ['朝日幹線','南山形幹線','山形幹線'])assert.equal(read('data/private/network-capacity.json').lines.find(l=>l.name===name).voltageKV,275);
});
test('three upgrades are distinct future records; dates never change current voltage',()=>{
 const plans=read('docs/research/tohoku-voltage-upgrade-plans.json');assert.equal(plans.length,3);
 const active=read('public/data/tokyo-trunk.json').changePlans;
 for(const p of plans){assert.equal(active.filter(x=>x.id===p.id).length,1);assert.equal(p.application.status,'未反映');assert.equal(p.latestProgressReview.checkedAt,null);}
 for(const p of plans.slice(0,2)){assert.equal(p.revisions[0].timing[0].raw,'2030年度以降');assert.equal(p.revisions[0].timing[0].qualifier,'on-or-after');}
});
