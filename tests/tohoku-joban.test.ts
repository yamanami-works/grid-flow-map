import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {referenceFlowPath} from '../src/flow-path.ts';import {rawSkip} from './raw-data.mjs';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const geo=read('public/data/tohoku-trunk-osm.json'),s=read('docs/research/tohoku-joban-split.json');
// 原本（data/raw）は使うテストの中で読む。公開リポジトリの Actions では原本がないときだけそのテストを飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
const RAW='data/raw/tohoku-joban/lines-joban.json';
test('常磐幹線 is split into 常磐北幹線・常磐南幹線 at 宮城丸森開閉所',()=>{
 assert.ok(!geo.lines.some((l:any)=>l.name==='常磐幹線'));
 const f=geo.facilities.find((x:any)=>x.id===s.facility.id);assert.equal(f.name,'宮城丸森開閉所');assert.equal(f.kind,'switchyard');assert.deepEqual(f.position,s.junction.position);
 const n=geo.lines.find((l:any)=>l.name==='常磐北幹線'),so=geo.lines.find((l:any)=>l.name==='常磐南幹線');
 assert.deepEqual(n.paths[0][0],s.junction.position);assert.deepEqual(so.paths[0].at(-1),s.junction.position);
 assert.equal(n.connections[0].facilities[0].id,f.id);assert.equal(so.connections[1].facilities[0].id,f.id);
});
test('常磐幹線 is split at the OSM node shared with the 新地 500kV way, which becomes 宮城丸森開閉所',{skip:rawSkip(RAW)},()=>{
 const raw=read(RAW);
 const w=raw.elements.find((e:any)=>e.id===s.osmWay),shinchi=raw.elements.find((e:any)=>e.id===s.shinchiWay);
 assert.ok(w.nodes.includes(s.junction.node));assert.ok([shinchi.nodes[0],shinchi.nodes.at(-1)].includes(s.junction.node));
 const n=geo.lines.find((l:any)=>l.name==='常磐北幹線'),so=geo.lines.find((l:any)=>l.name==='常磐南幹線');
 assert.equal(n.paths[0].length+so.paths[0].length-1,w.nodes.length);
});
test('OCCTO 常磐北幹線 and 常磐南幹線 flows follow their own half only',()=>{
 const day=typicalDay(read('public/data/occto-tohoku.json'));
 const north=referenceFlowPath(day.actual.lines.find((l:any)=>l.name==='常磐北幹線'),geo.lines,false)!,south=referenceFlowPath(day.actual.lines.find((l:any)=>l.name==='常磐南幹線'),geo.lines,false)!;
 assert.ok(north&&south);assert.deepEqual(north.at(-1),s.junction.position);assert.deepEqual(south[0],s.junction.position);
 assert.ok(north.every(p=>p[0]>=s.junction.position[0]));assert.ok(south.every(p=>p[0]<=s.junction.position[0]));
});
