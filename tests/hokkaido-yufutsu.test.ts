import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
// 2026-10-16 オーナー承認：勇払バイオマス発電の連系線（E区分＋推測）。勇払線の鉄塔16（OSM ref=16）から分岐、潮流・容量は持たせない
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const d=read('public/data/hokkaido-hokuto.json');
test('勇払バイオマス発電の連系線 branches from tower 16 of 勇払線 (E, inferred) and reaches the plant area; no flow or capacity row',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=d.lines.find((x:any)=>x.id==='hokkaido-feeder-187-1477837531'),y=d.lines.find((x:any)=>x.id==='hokkaido-section-35');
 assert.deepEqual(l.osmIds,[1477837531,1477837537,1477837532]);assert.deepEqual(l.cableOsmIds,[1477837532]);assert.equal(l.tsoSection,null);assert.equal(l.voltageKV,187);
 assert.deepEqual(l.connections.map((c:any)=>[c.node,c.status,c.facilities[0]?.id??null]),[[12896228675,'shared-node',null],[13556283964,'facility-area','way/1477837533']]);
 const e=evidenceOf(l);assert.equal(e.tier,'E');assert.ok(e.inferred.length>=1);
 for(let k=1;k<l.paths.length;k++)assert.deepEqual(l.paths[k][0],l.paths[k-1].at(-1));
 assert.ok(y.paths.flat().some((p:number[])=>p.join(',')===l.paths[0][0].join(',')),'勇払線の上に鉄塔16がある');
 assert.ok(/ref=16/.test(y.attributes.find((a:any)=>a.label==='公表区間').value));
 // 詳細パネルの回線数は注記の最初の「○回線」を拾うので、この線の1回線が先に来ること
 assert.equal(l.attributes.map((a:any)=>a.value.match(/(\d)回線/)?.[1]).find(Boolean),'1');
 assert.equal(d.facilities.find((x:any)=>x.id==='way/1477837533').attributes.filter((a:any)=>a.label==='系統との接続').length,1);
 if(existsSync('data/raw/hokkaido-holds-osm/towers-ref.json')){const t=read('data/raw/hokkaido-holds-osm/towers-ref.json').elements.find((x:any)=>x.type==='node'&&x.id===12896228675);assert.equal(t?.tags?.ref,'16');}
});
test('勇払バイオマス発電の連系線 gets no flow: no reviewed OCCTO row of 北海道 routes over it',async()=>{
 const {referenceFlowPath}=await import('../src/flow-path.ts');const {reviewedHokkaidoDay}=await import('../src/hokkaido-domain.ts');
 const raw=read('public/data/hokkaido-flow.json'),l=d.lines.find((x:any)=>x.id==='hokkaido-feeder-187-1477837531');
 // 分岐点（鉄塔16）は勇払線と共有するので除き、この線だけの点を通る潮流の経路が無いこと
 const own=new Set(l.paths.flat().slice(1).map((p:number[])=>p.join(',')));let n=0;
 for(const day of raw.days)for(const r of reviewedHokkaidoDay(day).actual.lines){const p=referenceFlowPath(r,d.lines,false);if(!p)continue;n++;assert.ok(!p.some((x:number[])=>own.has(x.join(','))),`${r.name} が連系線を通る`);}
 assert.ok(n>0,'潮流の経路が1つも作れない（照合の前提が変わった）');
});
