import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {applyStatus,statusLabel,STATUS_OVERRIDES} from '../src/asset-status.ts';import {pathDash,PLANNED_DASH} from '../src/line-drawing.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('status: unset becomes the default 運用中 recorded as unconfirmed; 廃止 only on facilities',()=>{
 const [a]=applyStatus([{id:'x',name:'x',voltageKV:275,paths:[],osmIds:[],named:true} as any]);assert.equal(a.status,'運用中');assert.equal(a.statusConfirmed,false);assert.equal(statusLabel(a),'運用中（未確認）');
 const t=read('public/data/tohoku-trunk.json'),tk=read('public/data/tokyo-trunk.json');const fac=applyStatus([...t.facilities,...tk.facilities]),lines=applyStatus([...t.lines,...tk.lines]);
 for(const n of ['旧福島第一原子力発電所','福島第二原子力発電所','秋田火力発電所'])assert.equal(fac.find((f:any)=>f.name===n).status,'廃止',n);
 assert.ok(!lines.some((l:any)=>l.status==='廃止'));
 const akita=lines.filter((l:any)=>l.connections?.some((c:any)=>c.facilities?.some((f:any)=>f.id==='osm-way-341478004')));assert.equal(akita.length,1);for(const l of akita){assert.equal(l.status,'運用中');assert.equal(statusLabel(l),'運用状態 未確認');}
 // 2026-10-09：廃止発電所はデータ側（docs/research/retired-plants.json、HJKS＋各社の公表）。発電所だけが廃止になり、線は廃止にならない。電源線は運用状態「未確認」
 const all=['tohoku-trunk','tohoku-dc-osm','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'].map(f=>read(`public/data/${f}.json`));
 const retired=read('docs/research/retired-plants.json').plants;
 // 2026-11-17 保留124-1：市原パワー市原発電所（廃止）は線につながっていないので地図から削除した（承認済み削除リスト）。記録は retired-plants.json に残す
 const removedF=new Set(read('tests/baseline/approved-removals.json').filter((a:any)=>a.kind==='facilities').map((a:any)=>a.id));
 for(const [id,r] of Object.entries<any>(retired)){if(removedF.has(id))continue;const f=all.flatMap((d:any)=>d.facilities).find((x:any)=>x.id===id);assert.ok(f,id);assert.equal(f.kind,'plant');assert.equal(f.status,'廃止',id);assert.equal(f.retiredAt,r.retiredAt);assert.match(f.statusSource,/HJKS/);}
 assert.ok(Object.keys(retired).length>=14);
 assert.ok(!all.some((d:any)=>d.facilities.some((f:any)=>f.status==='廃止'&&f.kind!=='plant')));
 assert.ok(!all.some((d:any)=>d.lines.some((l:any)=>l.status==='廃止')));
 const feeders=all.flatMap((d:any)=>d.lines).filter((l:any)=>l.statusConfirmed===false&&/は廃止/.test(l.statusCheck??''));assert.ok(feeders.length>=7); // 2026-10-18：阿南火力線・宮津線を空容量一覧の行に対応付けたので10→8。2026-11-09（保留97）：岩国火力発電所の連系線を新岩国連絡線との重複で外したので8→7
 assert.deepEqual(STATUS_OVERRIDES,{});
});
test('東清水線 is drawn as under construction with a long dash and its planned start; the 154kV FC link notes the exception and the unverified source',()=>{
 const t=read('public/data/tokyo-trunk.json');const l=t.lines.find((x:any)=>x.id==='tokyo-plan-東清水線');
 assert.equal(l.status,'建設中');assert.equal(l.plannedStart,'2027年1月');assert.match(l.statusSource,/供給計画/);assert.equal(pathDash(l,0),PLANNED_DASH);
 const fc=t.lines.find((x:any)=>x.id==='tokyo-fc-higashishimizu-154');assert.ok(fc.attributes.some((a:any)=>a.label==='対象電圧の例外'&&/FC交流側接続の例外/.test(a.value)));
 assert.match(fc.attributes.find((a:any)=>a.label==='出典').value,/一次資料未確認/);assert.ok(fc.attributes.some((a:any)=>a.label.startsWith('要注意')));
 assert.ok(t.changePlans.some((p:any)=>p.id==='tokyo-plan-shin-sakuma-higashi'&&p.revisions.some((r:any)=>r.status==='一次資料確認待ち')&&p.revisions.at(-1).status==='工事中'&&/J-POWER送変電/.test(p.revisions.at(-1).source.name)));
 const m=read('public/data/chubu-trunk.json').facilities.find((f:any)=>f.name==='馬瀬川第一発電所');assert.ok(m.attributes.some((a:any)=>a.label.startsWith('要注意')));assert.ok(!JSON.stringify(m.attributes).includes('Wikipedia'));
});
