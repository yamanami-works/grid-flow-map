import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';
import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';
import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const data=JSON.parse(readFileSync('public/data/hokkaido-hokuto.json','utf8'));
const raw=JSON.parse(readFileSync('public/data/hokkaido-flow.json','utf8'));
test('Doou south uses continuous real segments and both existing terminal asset IDs',()=>{
 const l=data.lines.find((l:any)=>l.name==='道央南幹線');assert.equal(l.voltageKV,275);assert.equal(l.currentType,'ac');
 const record={id:'test',name:l.name,voltageKV:275,from:'西双葉開閉所',to:'南早来変電所',values:[],note:''};
 const path=referenceFlowPath(record,data.lines,false);assert.ok(path);
 for(const [name,point] of [[record.from,path[0]],[record.to,path.at(-1)]])assert.ok(l.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(point)));
 const edges=new Set(l.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));
 for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 assert.equal(data.facilities.find((f:any)=>f.name==='西双葉開閉所').assetId,'asset-e94a16b1-f600-45d0-af5a-51e181843cbf');
});

test('Doou south aliases require exact public endpoints and do not borrow reverse capacity',()=>{
 const day=typicalDay(raw);const original=day.actual.lines.find((r:any)=>r.name==='道央南幹線');const reviewed=reviewedHokkaidoDay(day);const l=reviewed.actual.lines.find((r:any)=>r.name==='道央南幹線')!;
 assert.equal(l.from,'西双葉開閉所');assert.equal(l.to,'南早来変電所');assert.deepEqual(l.values,original.values);
 const caps=[{name:l.name,voltageKV:275,from:l.to,to:l.from,capacityMW:1197}];assert.equal(capacityReferenceUsage(l,100,caps),null);assert.equal(capacityReferenceUsage(l,-100,caps),100/1197*100);
 assert.equal(reviewedHokkaidoDay({...day,actual:{...day.actual,lines:[{...original,to:'大野SS'}]}}).actual.lines.length,0);
});
