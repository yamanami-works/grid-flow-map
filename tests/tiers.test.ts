import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const REGIONS=['chubu','hokuriku','kansai','chugoku','shikoku','kyushu'];
const tier=(l:any)=>l.attributes.find((a:any)=>a.label==='照合区分')?.value;
test('west areas: every line has a tier, only C/D carry 要注意, and A/B lines have an OCCTO 公表区間 and a reason',()=>{
 for(const r of REGIONS){const d=read(`public/data/${r}-trunk.json`);
  for(const l of d.lines){const caution=l.attributes.some((a:any)=>a.label.startsWith('要注意'));const t=tier(l);
   if(l.attributes.some((a:any)=>a.label.startsWith('要注意（D区分'))){assert.ok(caution);continue;}
   assert.match(t,/^[ABC]区分$/,r+' '+l.name);assert.equal(caution,t==='C区分',r+' '+l.name);
   assert.ok(l.attributes.some((a:any)=>a.label==='照合の根拠'),l.name);
   if(t!=='C区分')assert.ok(l.attributes.some((a:any)=>a.label==='公表区間'),l.name);}
  assert.match(d.coverage,/照合区分 A\d+・B\d+・C\d+/);}
});
test('lines without an OCCTO section (plant feeders, tie lines) stay C',()=>{
 for(const r of REGIONS)for(const l of read(`public/data/${r}-trunk.json`).lines)if(l.id.startsWith('tie-')||l.id.includes('-plant-'))assert.equal(tier(l),'C区分',l.name);
});
test('same-name OSM routes are A (関西 金剛線, 東大阪線) and routes via another named line stay C (紀北線 via 金剛線)',()=>{
 const k=read('public/data/kansai-trunk.json').lines;const by=(n:string)=>k.find((l:any)=>l.name===n);
 assert.equal(tier(by('金剛線')),'A区分');assert.equal(tier(by('東大阪線')),'A区分');assert.equal(tier(by('紀北線')),'C区分');
});
