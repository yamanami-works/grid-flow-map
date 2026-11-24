import test from 'node:test';import assert from 'node:assert/strict';
import {hokkaidoSnapshot} from '../scripts/hokkaido-flow.mjs';
import {keepCapacities} from '../scripts/occto-publication.mjs';
// 運用容量がOCCTO側で未公表（YA000010SW）の日の扱い（2026-10-25 オーナー承認 保留27。北陸・九州と、北海道・東京・中部・関西・中国・四国で共通）
const header=Object.fromEntries(Array.from({length:48},(_,i)=>['colonLbl'+String(i).padStart(2,'0'),{label:String(Math.floor(i/2)).padStart(2,'0')+(i%2?':30':':00')}]));
const actual={root:{bizRoot:{header,table:{table1:{table1:{totalPage:'1',rows:[{sdlNm:{value:'試験線'},daKv:{value:'275'},flowHukuSeiHuku:{value:'甲SS→乙SS'},...Object.fromEntries(Object.keys(header).map(k=>[k,{value:'100'}]))}]}}}}}};
const notPublished={root:{errMessage:{msgId:'YA000010SW'}}};
const capacity={root:{bizRoot:{table:{table1:{table1:{totalPage:'1',rows:[{sdlNo:{value:'1'},sdlNm:{value:'試験線'},daKv1:{value:'275'},flowHukuSeiHuku1:{value:'甲SS→乙SS'},unyr:{value:'500'},ktiYuin:{value:'熱容量'}}]}}}}}};
test('運用容量が未公表の応答では、容量は空で実績は残る（偽の値を入れない）',()=>{
 const d=hokkaidoSnapshot(actual,notPublished,'2026-10-25','2026-10-25T05:00:00.000Z');
 assert.deepEqual(d.capacities,[]);
 assert.equal(d.actual.lines.length,1);assert.equal(d.actual.lines[0].values[0],100);
});
test('その日に前に取れた運用容量と取得時刻を残す',()=>{
 const prev=hokkaidoSnapshot(actual,capacity,'2026-10-25','2026-10-25T01:00:00.000Z');
 const d=keepCapacities(hokkaidoSnapshot(actual,notPublished,'2026-10-25','2026-10-25T05:00:00.000Z'),prev);
 assert.equal(d.capacities.length,1);assert.equal(d.capacities[0].capacityMW,500);
 assert.equal(d.capacityRetrievedAt,'2026-10-25T01:00:00.000Z');assert.equal(d.retrievedAt,'2026-10-25T05:00:00.000Z');
 // 2回続けて未公表なら、最初に取れた時刻を引き継ぐ
 const again=keepCapacities(hokkaidoSnapshot(actual,notPublished,'2026-10-25','2026-10-25T06:00:00.000Z'),d);
 assert.equal(again.capacityRetrievedAt,'2026-10-25T01:00:00.000Z');
});
test('新しい応答に運用容量があれば前の値で上書きしない',()=>{
 const prev={capacities:[{id:'old',capacityMW:1}],retrievedAt:'2026-10-25T01:00:00.000Z'};
 const d=keepCapacities(hokkaidoSnapshot(actual,capacity,'2026-10-25','2026-10-25T05:00:00.000Z'),prev);
 assert.equal(d.capacities[0].capacityMW,500);assert.equal(d.capacityRetrievedAt,undefined);
});
test('その日に前の運用容量がなければ空のまま（使用率は灰＝未確認）',()=>{
 assert.deepEqual(keepCapacities(hokkaidoSnapshot(actual,notPublished,'2026-10-25','2026-10-25T05:00:00.000Z'),undefined).capacities,[]);
 assert.deepEqual(keepCapacities(hokkaidoSnapshot(actual,notPublished,'2026-10-25','2026-10-25T05:00:00.000Z'),{capacities:[],retrievedAt:'x'}).capacities,[]);
});
test('各地域の取り込み（北海道・東京・中部・北陸・関西・中国・四国・九州）とも、未公表の応答で容量は空・実績は残る',async()=>{
 for(const r of ['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu']){
  const mod=await import(`../scripts/${r}-flow.mjs`),d=mod[r+'Snapshot'](actual,notPublished,'2026-10-25','2026-10-25T05:00:00.000Z');
  assert.deepEqual(d.capacities,[],r);assert.equal(d.actual.lines.length,1,r);
 }
});
test('東北：未公表の応答では容量は空・実績は残り、線の ID は前に取れた容量で決めて変えない（2026-10-30 保留33）',async()=>{
 const {tohokuSnapshot}=await import('../scripts/tohoku-flow.mjs');
 const geo={facilities:[]},src=[{retrievedAt:'2026-10-30T01:00:00.000Z'},{retrievedAt:'2026-10-30T01:00:00.000Z'}];
 const full=tohokuSnapshot(actual,capacity,'2026-10-30',src,geo);
 assert.equal(full.actual.lines[0].id,'0001');assert.equal(full.capacities[0].capacityMW,500);
 const empty=tohokuSnapshot(actual,notPublished,'2026-10-30',src,geo,full.capacities);
 assert.deepEqual(empty.capacities,[]);assert.equal(empty.actual.lines[0].values[0],100);assert.equal(empty.actual.lines[0].id,'0001');
 assert.equal(keepCapacities(empty,full).capacities[0].capacityMW,500);
 assert.throws(()=>tohokuSnapshot(actual,{root:{errMessage:{msgId:'OTHER'}}},'2026-10-30',src,geo),/OCCTO error/);
});
