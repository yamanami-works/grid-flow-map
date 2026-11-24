import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
// @ts-ignore
import {snapshot,missing,BASELINE_FILES} from '../scripts/write-baseline.mjs';
const base=JSON.parse(readFileSync('tests/baseline/asset-ids.json','utf8')),approved=JSON.parse(readFileSync('tests/baseline/approved-removals.json','utf8'));
test('no line or facility of the national baseline disappears unless it is on the approved removal list',()=>{
 const lost=missing(base,snapshot(),approved);assert.deepEqual(lost,[],lost.slice(0,10).join('\n'));
 for(const a of approved)assert.ok(a.reason&&a.approvedAt,'approved removals need a reason and date');
});
test('all 10 regions are public catalog data that the build copies (geometry and flow)',()=>{
 const c=JSON.parse(readFileSync('public/data/catalog.json','utf8'));
 for(const f of BASELINE_FILES)assert.ok(c.datasets.some((d:any)=>d.url==='./data/'+f&&d.access==='public'),f);
 for(const r of ['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu','tie'])assert.ok(c.datasets.some((d:any)=>d.id===r+'-flow'),r);
 // 2026-10-04 東北の作り直しで1301本・588設備から減った（承認済み削除は tests/baseline/approved-removals.json）
 assert.ok(base.counts.lines>=603&&base.counts.facilities>=538);
});
test('refetch rotates through the 30-day window, oldest retrieval first, never today or yesterday',async()=>{
 // @ts-ignore
 const {refetchDates,windowDates}=await import('../scripts/occto-publication.mjs');
 const w=windowDates('2026-10-03');const days=w.map((date:string,i:number)=>({date,retrievedAt:`2026-10-${String(3-Math.min(i,2)).padStart(2,'0')}T0${i%10}:00:00Z`}));
 days.find((d:any)=>d.date==='2026-09-10').retrievedAt='2026-09-11T00:00:00Z';
 const r=refetchDates('2026-10-03',days);assert.equal(r.length,2);assert.equal(r[0],'2026-09-10');assert.ok(!r.includes('2026-10-03')&&!r.includes('2026-10-02'));
});
test('the TSO transformer table is private-preview only: flagged in the catalog, excluded by the public build filter, kept in data/private for the private preview',{skip:!existsSync('data/private/substation-voltages.json')&&'data/private/ なし'},()=>{
 const c=JSON.parse(readFileSync('public/data/catalog.json','utf8'));const d=c.datasets.find((x:any)=>x.id==='substation-voltages');
 assert.equal(d.distribution,'private-preview');assert.match(readFileSync('vite.config.ts','utf8'),/distribution!=='private-preview'/);
 assert.ok(JSON.parse(readFileSync('data/private/substation-voltages.json','utf8')).regions.kansai);assert.ok(!existsSync('public/data/substation-voltages.json'));
});
