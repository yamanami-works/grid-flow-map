import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {excludedSkip} from './raw-data.mjs';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),d=read('public/data/hokkaido-hokuto.json'),r=read('docs/research/hokkaido-remaining-route.json').routes[0];
test('Eniwa-Nansatsu connects only its two terminals along acquired edges',()=>{
 const l=d.lines.find((l:any)=>l.id===r.lineAssetId);assert.equal(l.voltageKV,187);assert.equal(l.currentType,'ac');
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},d.lines,false);assert.ok(path);
 for(const [name,point] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(l.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(point)));
 const edges=new Set(r.lines.flatMap((w:any)=>w.coordinatesLatLon.slice(1).flatMap((x:any,i:number)=>[JSON.stringify([w.coordinatesLatLon[i],x]),JSON.stringify([x,w.coordinatesLatLon[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 assert.ok(r.lines.every((w:any)=>w.tags.voltage==='187000'));assert.equal(d.facilities.filter((f:any)=>f.name==='南札幌変電所').length,1);assert.equal(d.facilities.find((f:any)=>f.name==='南札幌変電所').assetId,'asset-589c6c4a-7848-4851-9c37-bb20568ff9d3');
 assert.ok(!l.connections.some((c:any)=>c.facilities.some((f:any)=>/追分|北新得/.test(f.name))));
});
test('Eniwa actual positive direction stays opposite capacity direction without filling missing direction',()=>{
 const raw=typicalDay(read('public/data/hokkaido-flow.json')),m=reviewedHokkaidoDay(raw),a=m.actual.lines.find((l:any)=>l.name===r.name)!,c=m.capacities.find((l:any)=>l.name===r.name)!;
 assert.ok(a);assert.ok(c);assert.equal(a.from,'南札幌変電所');assert.equal(a.to,'恵庭変電所');assert.equal(c.from,'恵庭変電所');assert.equal(c.to,'南札幌変電所');assert.deepEqual(a.values,raw.actual.lines.find((l:any)=>l.id===a.id).values);assert.ok(referenceFlowPath(a,d.lines,false));
 assert.ok(capacityReferenceUsage(a,-100,m.capacities));assert.equal(capacityReferenceUsage(a,100,m.capacities),null);
});
// 調査記録 hokkaido-remaining-review.json は空容量一覧の行を含むので公開リポジトリに入れない（保留95）。公開リポジトリの Actions では、ないときだけ飛ばす
test('All requested remaining sections are reviewed',{skip:excludedSkip('docs/research/hokkaido-remaining-review.json')},()=>{
 const review=read('docs/research/hokkaido-remaining-review.json');assert.equal(review.entries.length,21);assert.equal(new Set(review.entries.map((x:any)=>x.publicSectionId)).size,21);assert.ok(review.entries.every((x:any)=>x.result&&x.restartCondition));
});
test('All requested remaining sections are reviewed, retrieval failure remains distinct',()=>{
 const p=read('docs/research/hokkaido-section-status.json');
 assert.equal(p.sections.length,89);assert.equal(p.sections.filter((s:any)=>s.research==='未調査').length,0);const s=p.sections.find((s:any)=>s.publicSectionId==='86');// 2026-10-01 再取得でOSMに区画・経路がないことを確認（取得障害→根拠不足）
 // 2026-10-06 オーナー指摘「静内線は春別発電所と静内発電所間の線では」でOSMの線（way 414978983）をC区分で採用
 assert.equal(s.obstacleType,undefined);assert.equal(s.research,'C区分で採用（OSMの経路のみ・要注意）');assert.equal(s.geography,'地理表示済み');
 assert.deepEqual(p.trunk275,{basis:'2026-08-28版、2026-09-27公式掲載ZIP再取得で保存版とバイト一致',publicSectionCount:14,displayed:14,partial:0,held:0,flowMatched:7});assert.equal(p.sections.filter((s:any)=>s.geography==='部分表示').length,0);
});
