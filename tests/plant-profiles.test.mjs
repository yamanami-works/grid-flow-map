import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../public/data/plant-profiles.json',import.meta.url),'utf8')).records;
// 2026-11-18 保留131：関西電力 水力発電所一覧（kepco.co.jp、発電事業者の一次資料）を出典に足した
test('plant capacities have primary citations and ambiguous facilities remain unknown',()=>{
 assert.equal(new Set(data.map(p=>p.id)).size,data.length);
 for(const p of data.filter(p=>p.capacityMW!==null)){assert.ok(p.sources.length);assert.ok(p.capacityMW>0);for(const s of p.sources)assert.match(s.url,/^https:\/\/((www\d?\.)?(tohoku-epco|tepco|jera|jpower|somakyoka|kepco|chuden)\.co\.jp|www\.mhi\.com|www\.eurus-energy\.com)\//);}
 assert.equal(data.find(p=>p.id==='osm-way-354115662').capacityMW,null);
 assert.equal(data.find(p=>p.id==='osm-way-618344823').operator,'JERA');
 assert.equal(data.find(p=>p.id==='osm-way-618344823').capacityMW,2380);
 for(const id of ['osm-way-341478004','osm-way-103783431','osm-way-104409614'])assert.equal(data.find(p=>p.id===id).capacityMW,null);
});
// 2026-11-20 保留137：三菱重工の実証設備（第二T地点）は 566MW（三菱重工 プレスリリース 2022-02-14）
test('実証設備複合サイクル発電所（三菱重工）は 566MW',()=>{assert.equal(data.find(x=>x.id==='osm-way-1093999564').capacityMW,566);assert.ok(!data.some(x=>x.id==='osm-way-969601128'));});
