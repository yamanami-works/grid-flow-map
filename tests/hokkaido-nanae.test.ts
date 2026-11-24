import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';
import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';
import {capacityReferenceUsage} from '../src/occto-domain.ts';
const data=JSON.parse(readFileSync('public/data/hokkaido-hokuto.json','utf8'));
const raw=JSON.parse(readFileSync('public/data/hokkaido-flow.json','utf8'));
test('Nanae uses continuous real segments and both existing terminal asset IDs',()=>{
 const l=data.lines.find((l:any)=>l.name==='北本七飯線');assert.equal(l.voltageKV,187);assert.equal(l.currentType,'ac');
 const record={id:'test',name:l.name,voltageKV:187,from:'北七飯変電所',to:'函館変換所',values:[],note:''};
 const path=referenceFlowPath(record,data.lines,false);assert.ok(path);
 for(const [name,point] of [[record.from,path[0]],[record.to,path.at(-1)]])assert.ok(l.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(point)));
 const edges=new Set(l.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));
 for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 assert.equal(data.facilities.find((f:any)=>f.name==='函館変換所').assetId,'asset-e24810a7-7446-41da-9015-000433dd231f');
});
test('Nanae exact endpoint aliases preserve observations and do not borrow opposite capacity',()=>{
 const day=raw.days.find((d:any)=>d.actual.lines.some((r:any)=>r.name==='北本七飯線'));
 const original=day.actual.lines.find((r:any)=>r.name==='北本七飯線');const reviewed=reviewedHokkaidoDay(day);
 const l=reviewed.actual.lines.find((r:any)=>r.name==='北本七飯線')!;assert.equal(l.id,original.id);assert.deepEqual(l.values,original.values);
 const caps=[{name:l.name,voltageKV:187,from:'函館変換所',to:'北七飯変電所',capacityMW:714}];
 assert.equal(capacityReferenceUsage(l,100,caps),null);assert.equal(capacityReferenceUsage(l,-100,caps),100/714*100);
 assert.equal(capacityReferenceUsage(l,-100,[{...caps[0],capacityMW:null}]),null);
 assert.equal(reviewedHokkaidoDay({...day,actual:{...day.actual,lines:[{...original,to:'北斗変換所'}]}}).actual.lines.length,0);
});
