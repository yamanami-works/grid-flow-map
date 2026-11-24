import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {excludedSkip} from './raw-data.mjs';
import {referenceFlowPath} from '../src/flow-path.ts';
import {endpointConflict} from '../src/flow-quality.ts';
import {endpointName} from '../src/endpoint-aliases.ts';
import {compareCapacity} from '../src/capacity-comparison.ts';
import {lineWidth,particleWidth} from '../src/line-style.ts';
import type {Geography} from '../src/real-domain.ts';
const geography:Geography=JSON.parse(readFileSync(new URL('../public/data/tohoku-trunk-osm.json',import.meta.url),'utf8'));
// 東北電力NW の空容量一覧（送電線）は携帯用ビルドだけ（data/private/、Git の管理外。2026-11-09 保留95 ⑤-b）
const NETWORK='data/private/network-capacity.json';
const network=existsSync(NETWORK)?JSON.parse(readFileSync(NETWORK,'utf8')).lines:[];
const towada={id:'0001',name:'十和田幹線',voltageKV:500,from:'上北',to:'岩手変電所',values:[160],note:''};
test('endpoint alias is restricted to Towada 500kV, never the converter or other circuits',{skip:excludedSkip(NETWORK)},()=>{
 assert.equal(endpointName(towada,'上北'),'上北変電所');
 assert.equal(endpointName(towada,'上北変換所'),'上北変換所');
 assert.equal(endpointName({...towada,voltageKV:275},'上北'),'上北');
 assert.equal(endpointName({...towada,name:'他路線'},'上北'),'上北');
 assert.equal(endpointConflict(towada,network),false);
 assert.equal(endpointConflict({...towada,from:'上北変換所'},network),true);
 // 勿来幹線のOCCTO 1行（須賀川→いわき）は勿来幹線＋勿来支線にまたがる既知の行（2026-10-02）。それ以外の端点は引き続き除外
 assert.equal(endpointConflict({...towada,name:'勿来幹線',voltageKV:275,from:'須賀川変電所',to:'いわき変電所'},network),false);
 assert.equal(endpointConflict({...towada,name:'勿来幹線',voltageKV:275,from:'須賀川変電所',to:'新いわき開閉所'},network),true);
 const capacity={...towada,capacityMW:4936,constraint:'熱容量'};
 assert.deepEqual(compareCapacity(network.find((l:{name:string})=>l.name===towada.name),capacity),[]);
 assert.ok(compareCapacity(network.find((l:{name:string})=>l.name===towada.name),{...capacity,from:'岩手変電所',to:'上北'}).some(s=>s.includes('方向')));
});
test('Towada route reaches both footprints via existing composite and unnamed segments, with no invented edges',()=>{
 const path=referenceFlowPath(towada,geography.lines,false)!;assert.ok(path);
 assert.deepEqual(path[0],[40.7837795,141.1756488]);assert.deepEqual(path.at(-1),[39.9060785,141.1776202]);
 const key=(p:number[])=>p.join(',');const edge=(a:number[],b:number[])=>[key(a),key(b)].sort().join('|');
 const edges=new Map<string,number>();for(const l of geography.lines)for(const [i,p] of l.paths.entries())for(let j=1;j<p.length;j++)edges.set(edge(p[j-1],p[j]),l.osmIds[i]);
 const used=new Set<number>();for(let i=1;i<path.length;i++){const id=edges.get(edge(path[i-1],path[i]));assert.notEqual(id,undefined);used.add(id!);}
 assert.deepEqual([...used],[798992454,736989141,736989140,244378760,250015258]);
 assert.deepEqual(referenceFlowPath({...towada,from:towada.to,to:towada.from},geography.lines,false),[...path].reverse());
 assert.equal(referenceFlowPath(towada,geography.lines.filter(l=>!l.osmIds.includes(736989140)),false),null);
 assert.equal(referenceFlowPath({...towada,from:'上北変換所'},geography.lines,false),null);
});
test('voltage strokes and particles retain hierarchy including DC250, independent of flow samples',()=>{
 assert.equal(lineWidth(500),6);assert.equal(lineWidth(275),3.5);assert.equal(lineWidth(250),2.8);
 for(const kv of [500,275,250])assert.ok(particleWidth(kv)<lineWidth(kv));
 assert.equal(particleWidth(500),4.5);assert.equal(particleWidth(275),2.625);
});
test('DC particles are 1px wider than the DC stroke so they stay visible on the thin DC stroke (2026-10-23)',()=>{
 assert.equal(particleWidth(200,'default','dc'),lineWidth(200,'default','dc')+1);assert.equal(particleWidth(200,'default','dc'),3.8);
 assert.equal(particleWidth(250,'hokkaido','dc'),3.8);
 assert.ok(particleWidth(250,'default','ac')<lineWidth(250,'default','ac'));
});
