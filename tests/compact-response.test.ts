import {gunzipSync} from 'node:zlib';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compactJson,sendBody} from '../scripts/compact-response.mjs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';
import {excludedSkip} from './raw-data.mjs';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const raw=(p:string)=>readFileSync(p);const parse=(b:Buffer)=>JSON.parse(b.toString('utf8'));
test('compacted map data keeps every OCCTO flow route that the stored data has',()=>{
 const cases:[string,any,any[]][]=[
  ['public/data/tohoku-trunk-osm.json',null,typicalDay(parse(raw('public/data/occto-tohoku.json'))).actual.lines],
  ['public/data/hokkaido-hokuto.json',null,reviewedHokkaidoDay(typicalDay(parse(raw('public/data/hokkaido-flow.json')))).actual.lines],
  ['public/data/tokyo-trunk.json',null,reviewedTokyoDay(typicalDay(parse(raw('public/data/tokyo-flow.json')))).actual.lines]];
 for(const [file,,rows] of cases){const stored=parse(raw(file)),small=parse(compactJson(raw(file)));
  assert.ok(compactJson(raw(file)).length<=raw(file).length,file);
  for(const r of rows)assert.equal(!!referenceFlowPath(r,small.lines,false),!!referenceFlowPath(r,stored.lines,false),file+' '+r.name);}
});
// 宮城の検証ファイルは公開リポジトリに入れない（保留49・95）。公開リポジトリの Actions では、ないときだけ飛ばす
test('gzip only when accepted; byte-verified bodies are passed through unchanged',{skip:excludedSkip('data/validation/miyagi-ishinomaki.json')},()=>{
 const body=raw('data/validation/miyagi-ishinomaki.json');let sent:any,headers:any;
 const res={getHeader:()=>undefined,writeHead:(_s:number,h:any)=>{headers=h;},end:(b:any)=>{sent=b;}};
 sendBody({method:'GET',headers:{}},res,200,{'Content-Type':'application/json'},body);assert.deepEqual(sent,body);assert.equal(headers['Content-Encoding'],undefined);
 sendBody({method:'GET',headers:{'accept-encoding':'gzip, br'}},res,200,{'Content-Type':'application/json'},body);assert.equal(headers['Content-Encoding'],'gzip');
 assert.deepEqual(gunzipSync(sent),body);
});
