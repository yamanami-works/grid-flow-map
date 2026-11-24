import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';import {rawSkip} from './raw-data.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-north-187-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: 187kV route reaches its own public terminals without 275kV inference`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.voltageKV,187);assert.equal(line.currentType,'ac');assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 const pending=[...r.lines],nodes=new Set<string>(pending.shift().nodes);let n=-1;while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>nodes.has(x))){pending[i].nodes.forEach((x:string)=>nodes.add(x));pending.splice(i,1);}}assert.equal(pending.length,0);
 assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('187000')));
});

test('northern flows preserve separate sections and directional capacity',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day);
 for(const r of review.routes){const l=mapped.actual.lines.find((x:any)=>x.name===r.name)!;assert.ok(l);assert.ok(referenceFlowPath(l,data.lines,false));assert.deepEqual(l.values,day.actual.lines.find((x:any)=>x.id===l.id).values);const c=mapped.capacities.find((x:any)=>x.name===r.name)!;assert.ok(c);const sign=c.from===l.from?1:-1;assert.ok(capacityReferenceUsage(l,sign*100,mapped.capacities));assert.equal(capacityReferenceUsage(l,-sign*100,mapped.capacities),null);}
 assert.equal(new Set(review.routes.map((r:any)=>mapped.actual.lines.find((x:any)=>x.name===r.name)!.id)).size,5);
 assert.equal(data.facilities.filter((f:any)=>f.name==='旭川嵐山開閉所').length,1);assert.equal(data.facilities.find((f:any)=>f.name==='旭川嵐山開閉所').kind,'switchyard');
 // 2026-10-01 C区分で採用：旭川変電所の手前約3.2kmは直線（ルート不明）。
 const asahi=data.lines.find((l:any)=>l.name==='旭川南線');assert.equal(asahi.schematicParts.length,1);assert.ok(referenceFlowPath(mapped.actual.lines.find((l:any)=>l.name==='旭川南線')!,data.lines,false));
});
// 2026-11-09 保留93：OCCTO の運用容量の表は日によって形が変わる（10/29・11/9 は北幌延線の行がなく、名寄幹線の値が普段の約2倍。11/9 の西旭川→旭川嵐山は「熱容量（作業）」。理由は未確認）。
// 運用容量の行がない日は容量を埋めない（参考使用率は不明）。最新日でも実績は区間を分けたまま公表値どおり。運用容量が0行（未公表）の日は対象外
test('北幌延線の運用容量がない日は参考使用率を出さない。最新日の実績は公表値どおり',()=>{
 for(const day of raw.days.filter((d:any)=>d.capacities.length&&!d.capacities.some((c:any)=>c.name==='北幌延線'))){const m=reviewedHokkaidoDay(day),l=m.actual.lines.find((x:any)=>x.name==='北幌延線');if(!l)continue;/* 実績の行もない日は対象外 */assert.equal(capacityReferenceUsage(l,100,m.capacities),null,day.date);assert.equal(capacityReferenceUsage(l,-100,m.capacities),null,day.date);}
 const latest=raw.days.reduce((a:any,b:any)=>a.date>b.date?a:b),m=reviewedHokkaidoDay(latest);
 for(const r of review.routes){const l=m.actual.lines.find((x:any)=>x.name===r.name);if(!l)continue;/* 行がない日も落とさない。行があれば値を書き換えていないことだけ確かめる */
 assert.deepEqual(l.values,latest.actual.lines.find((x:any)=>x.id===l.id).values,r.name);}
});
const capFile=(d:string)=>`data/raw/occto-hokkaido-${d}/capacity.json`;
test('選んだ日の名寄幹線の運用容量は原本どおり',{skip:rawSkip(capFile(typicalDay(raw).date))},()=>{
 const day=typicalDay(raw),rows=read(capFile(day.date)).root.bizRoot.table.table1.table1.rows.filter((r:any)=>r.sdlNm.value==='名寄幹線');
 assert.equal(rows.length,2);for(const r of rows)assert.equal(day.capacities.find((c:any)=>c.id==='hk-cap-'+r.sdlNo.value)?.capacityMW,Number(String(r.unyr.value).replaceAll(',','')));
});
