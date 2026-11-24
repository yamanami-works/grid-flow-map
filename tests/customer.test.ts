// 需要家の設備・線の規則（2026-10-11 オーナー指示、docs/CUSTOMER_FACILITIES.md）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {evidenceOf,facilityTierOf} from '../src/evidence.ts';import {flowCardHtml} from '../src/detail-panel.ts';import {facilitySymbol} from '../src/facility-symbol.ts';
import {candidateGeometry} from '../src/real-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const FILES=['tohoku-trunk','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'];
const geo=FILES.map(f=>({file:f,...read(`public/data/${f}.json`)}));
const customers=geo.flatMap(g=>g.facilities.filter((f:any)=>f.kind==='customer'||(f.alsoKinds??[]).includes('customer')).map((f:any)=>({...f,file:g.file})));
const PRIMARY=/需要家|一般送配電会社|OCCTO|行政|メーカー技報/;

test('customer facilities follow the naming rule (real name only with a primary source that names the facility)',()=>{
 assert.ok(customers.length>=1);
 for(const f of customers){
  const c=f.customer;assert.ok(c,f.id);assert.equal(f.name,c.displayName,f.id);
  // 一次資料の検索結果を必ず記録
  assert.ok(c.sources.some((s:any)=>s.kind==='primary'&&s.result),f.id);
  const named=c.sources.filter((s:any)=>s.kind==='primary'&&s.namesFacility&&PRIMARY.test(s.category));
  if(c.displayName!=='需要家'){assert.ok(named.length,f.id);assert.equal(c.nameStatus,'confirmed');assert.equal(c.officialName,c.displayName);}
  else assert.equal(c.nameStatus,'unconfirmed',f.id);
  // 受電電圧は対象範囲（500/275kV、北海道は187kV）
  assert.ok(c.receivingKV.some((kv:number)=>kv===500||kv===275||(f.file==='hokkaido-hokuto'&&kv===187)),f.id);
  // 補助資料のみなら確度E
  if(!named.length)assert.equal(facilityTierOf(f),'E',f.id);
 }
});

// 実名未確認の需要家の補助資料上の名称は、配布しない docs/research/customer-aux-names.json にだけ置く（2026-10-13）。
// 配信データには auxName の項目を持たせず、名称・事業者タグ・OSMの設備ページへのリンクも出さない
test('auxiliary names of unconfirmed customers are kept out of the distributed data',()=>{
 for(const g of geo)assert.ok(!JSON.stringify(g).includes('"auxName"'),g.file+' has auxName');
 for(const f of customers.filter(f=>f.customer.nameStatus==='unconfirmed')){
  assert.equal(f.url,'',f.id+' links to the OSM feature page');
  assert.ok(!f.customer.sources.some((s:any)=>/openstreetmap\.org\/(way|node|relation)\//.test(s.url??'')),f.id+' source links to the OSM feature page');
 }
 const internal='docs/research/customer-aux-names.json';
 if(!existsSync(internal))return; // 公開リポジトリには内部ファイルがない
 for(const e of read(internal).entries){
  // 2026-10-16 需要家と決めていない線の候補（lineId）も、補助資料上の名称を配信データに出さない
  // 2026-10-18 地図に描いていない線の候補（osmWayIds）：その線の名称が配信データに出ないこと
  if(e.osmWayIds){for(const g of geo)for(const l of g.lines)assert.ok(![...(l.osmIds??[]),...(l.sourceOsmIds??[])].some((i:number)=>e.osmWayIds.includes(Math.abs(i))),`${l.id} draws a way of an undrawn candidate`);const core=e.auxName.replace(/線$/,'');for(const g of geo)assert.ok(!JSON.stringify(g).includes(core),`${g.file} contains the auxiliary name`);continue;}
  if(e.lineId){assert.ok(geo.some(g=>g.lines.some((l:any)=>l.id===e.lineId)),e.lineId);const core=e.auxName.replace(/線$/,'');for(const g of geo)assert.ok(!JSON.stringify(g).includes(core),`${g.file} contains the auxiliary name`);continue;}
  const f=customers.find(x=>x.id===e.facilityId);assert.ok(f,e.facilityId);
  const core=e.auxName.replace(e.operatorTag??'','').replace(/(変電所|発電所)$/,'');
  for(const g of geo)assert.ok(!JSON.stringify(g).includes(core),`${g.file} contains the auxiliary name`);
  // 事業者タグも、その需要家の設備と、そこにつながる線には出さない
  if(e.operatorTag){const linked=geo.flatMap(g=>g.lines).filter((l:any)=>(l.connections??[]).some((c:any)=>c.facilities.some((x:any)=>x.id===f.id)));
   assert.ok(![f,...linked].some(x=>JSON.stringify(x).includes(e.operatorTag)),f.id+' shows the operator tag');}
 }
});

test('customer lines have an owner, end at a customer, and carry no OCCTO row',()=>{
 const tokyo=typicalDay(read('public/data/tokyo-flow.json')).actual.lines;
 const lines=geo.flatMap(g=>g.lines.filter((l:any)=>l.lineType==='customer'));
 assert.ok(lines.length>=1);
 for(const l of lines){
  assert.ok(['需要家','一般送配電会社','未確認'].includes(l.customerLine?.owner),l.id);
  assert.ok((l.connections??[]).some((c:any)=>c.facilities.some((x:any)=>customers.some(f=>f.id===x.id))),l.id);
  assert.equal(tokyo.filter((r:any)=>candidateGeometry(r,[l]).length).length,0,l.id);
 }
 // 中東京幹線の南側（玉原線分岐→需要家）は需要家線・確度E、北側は No.55 の通常の線
 const south=geo.flatMap(g=>g.lines).find((l:any)=>l.id==='ledger-tokyo-275-519125413-south'),north=geo.flatMap(g=>g.lines).find((l:any)=>l.id==='ledger-tokyo-275-519125413');
 assert.equal(south.lineType,'customer');assert.equal(evidenceOf(south).tier,'E');assert.equal(north.lineType,undefined);
});

test('tier E is the lowest tier for lines and facilities; D keeps its meaning',()=>{
 const base={id:'x',name:'x',voltageKV:275,paths:[],osmIds:[],named:true};
 assert.equal(evidenceOf({...base,attributes:[{label:'照合区分',value:'E区分'}]}).tier,'E');
 assert.equal(evidenceOf({...base,attributes:[{label:'要注意（E区分）',value:'補助資料のみ'}]}).tier,'E');
 assert.equal(evidenceOf({...base,attributes:[{label:'照合区分',value:'D区分'}],connections:[{node:1,position:[0,0],status:'facility-area',facilities:[{id:'a',name:'a'}],neighborWays:[]},{node:2,position:[0,0],status:'facility-area',facilities:[{id:'b',name:'b'}],neighborWays:[]}]} as any).tier,'D');
 assert.equal(facilityTierOf({url:'https://www.openstreetmap.org/way/1',evidenceTier:'E'}),'E');
 assert.equal(facilityTierOf({url:'https://www.openstreetmap.org/way/1',attributes:[{label:'要注意（E区分）',value:'OSMのみ'}]}),'E');
});

test('flow card distinguishes "not published" from "unknown", and the customer symbol is a hexagon',()=>{
 const ex=flowCardHtml('excluded'),none=flowCardHtml('none');
 assert.match(ex,/潮流公表対象外/);assert.doesNotMatch(ex,/未確認/);assert.doesNotMatch(none,/潮流公表対象外/);
 assert.match(facilitySymbol('customer'),/M7\.5 4\.2h9l4\.5 7\.8/);
});
