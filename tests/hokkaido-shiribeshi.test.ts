import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),d=read('public/data/hokkaido-hokuto.json'),r=read('docs/research/hokkaido-shiribeshi-route.json');
for(const section of r.routes)test('Shiribeshi section '+section.publicSectionId+' preserves real shared-node geometry and review status',()=>{
 const l=d.lines.find((l:any)=>l.assetId===section.lineAssetId);assert.equal(l.voltageKV,275);assert.equal(l.currentType,'ac');assert.deepEqual(l.paths.slice(0,section.lines.length),section.lines.map((x:any)=>x.coordinatesLatLon));
 const pending=[...section.lines],nodes=new Set<string>(pending.shift().nodes);let prev=-1;while(prev!==pending.length){prev=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((n:string)=>nodes.has(n))){pending[i].nodes.forEach((n:string)=>nodes.add(n));pending.splice(i,1)}}assert.equal(pending.length,0);assert.ok(nodes.has(r.junction.node));
 assert.ok(l.connections.some((c:any)=>c.node===Number(r.junction.node)&&c.status==='shared-node'&&c.facilities.length===0));
 if(section.status==='partial'){// 2026-10-01 京極発電所まで末端を直線で補完
  assert.equal(l.referenceReview.status,'section');assert.equal(l.schematicParts.length,1);assert.equal(l.paths.length,section.lines.length+1);assert.ok(l.connections.some((c:any)=>c.facilities.some((f:any)=>f.name==='京極発電所')));}else{assert.equal(l.referenceReview.status,'section');assert.ok(l.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===section.from)));}
});
test('public sections split without overlapping edges or a fictitious facility at #115',()=>{
 const parts=r.routes.filter((x:any)=>x.publicSectionId!=='8').map((x:any)=>x.lines[0].nodes);assert.deepEqual(parts[0].filter((n:string)=>parts[1].includes(n)),[r.junction.node]);assert.equal(d.facilities.some((f:any)=>f.name.includes('115')),false);assert.equal(d.facilities.filter((f:any)=>!String(f.assetId).startsWith('hokkaido-fac-')&&!String(f.assetId).startsWith('plant-fac-')).length,38);// 33：2026-11-10 hokkaido-place-足寄発電所（保留112、J-POWER の一覧と国土地理院の注記）を足した。38：2026-11-21 保留138 で今金中里変電所・上八雲開閉所・木古内開閉所・せたな大里ウインドファーム・上ノ国第二風力発電所（place）を足した
 const mapped=reviewedHokkaidoDay(typicalDay(read('public/data/hokkaido-flow.json')));assert.ok(!mapped.actual.lines.some(l=>/後志|京極/.test(l.name)));assert.ok(!mapped.capacities.some(l=>/後志|京極/.test(l.name)));
});

