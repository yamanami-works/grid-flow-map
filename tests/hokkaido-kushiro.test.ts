import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-kushiro-nissho-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: 187kV route reaches its own public terminals without 275kV inference`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.voltageKV,187);assert.equal(line.currentType,'ac');assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 const pending=[...r.lines],nodes=new Set<string>(pending.shift().nodes);let n=-1;while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>nodes.has(x))){pending[i].nodes.forEach((x:string)=>nodes.add(x));pending.splice(i,1);}}assert.equal(pending.length,0);
 assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('187000')));
});

test('Kushiro/Nissho main sections retain independent observations and direction-specific capacity',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day),ids=new Set();
 for(const r of review.routes){const l=mapped.actual.lines.find((x:any)=>x.name===r.name)!;assert.ok(l);ids.add(l.id);assert.ok(referenceFlowPath(l,data.lines,false));assert.deepEqual(l.values,day.actual.lines.find((x:any)=>x.id===l.id).values);const c=mapped.capacities.find((x:any)=>x.name===r.name)!;assert.ok(c);const sign=c.from===l.from?1:-1;assert.ok(capacityReferenceUsage(l,sign*100,mapped.capacities));assert.equal(capacityReferenceUsage(l,-sign*100,mapped.capacities),null);}
 assert.equal(ids.size,2);// 胆振幹線は公表の端点とOSMの経路が一致しないので公表区間としては描かない。2026-10-04 から公表台帳の線（ledger-、C区分・要注意）としてだけ描く
 assert.ok(data.lines.filter((l:any)=>l.name==='胆振幹線').every((l:any)=>l.id.startsWith('ledger-')&&l.attributes.some((a:any)=>a.label.startsWith('要注意'))));
 assert.equal(data.facilities.filter((f:any)=>f.name==='双葉開閉所').length,1);assert.equal(data.facilities.find((f:any)=>f.name==='双葉開閉所').id,'way/254548831');assert.equal(data.facilities.find((f:any)=>f.name==='西双葉開閉所').id,'way/518829081');
 for(const f of review.facilities)assert.equal(data.facilities.filter((x:any)=>x.assetId===f.assetId).length,1);
});

test('Public section progress partitions unrecorded research and does not mark #162 complete',()=>{
 const p=read('docs/research/hokkaido-section-status.json');assert.equal(new Set(p.sections.map((s:any)=>s.publicSectionId)).size,89);
 const u=p.sections.filter((s:any)=>s.geography==='未収録');assert.equal(u.length,8);// 2026-10-06 送86 静内線をオーナー指摘で採用（13→12）、北新得の北東の他社線 送108・109・110・114（12→8）assert.ok(u.every((s:any)=>['未調査','調査中','根拠不足で保留'].includes(s.research)));
 // 2026-10-01 #162を奥沙流支線との共有ノードで特定。地図はOCCTO公表区間の1本のまま。
 for(const id of ['74','75'])assert.equal(p.sections.find((s:any)=>s.publicSectionId===id).geography,'地理表示済み');
 assert.equal(data.lines.filter((l:any)=>l.name.startsWith('日勝幹線（新冠SWS')).length,1);assert.ok(!data.facilities.some((f:any)=>f.name.includes('#162')));
 assert.equal(p.sections.filter((s:any)=>s.geography==='部分表示').length,0);
});
