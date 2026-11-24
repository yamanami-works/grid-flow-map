import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {facilityTierOf} from '../src/evidence.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
// 詳細パネル段階②（2026-10-09）：各社の系統空容量一覧の設備容量・N-1電制・出力制御・回線数（tools/prep/build-line-capacity.mjs）
// 各社の表は data/private/（Git の管理外、docs/RULES.md 5節）。手元にないときは飛ばす
test('line capacity rows are attached to map lines and stay out of the public build',{skip:!existsSync('data/private/line-capacity.json')&&'data/private/ なし'},()=>{
 const d=read('data/private/line-capacity.json');assert.ok(!existsSync('public/data/line-capacity.json'));const n=Object.keys(d.lines).length;assert.ok(n>=450,String(n));
 const all=['tohoku-trunk','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'].flatMap(f=>read(`public/data/${f}.json`).lines);
 for(const [id,r] of Object.entries<any>(d.lines)){const l=all.find(x=>x.id===id);assert.ok(l,id);assert.equal(r.kv,l.voltageKV,id);assert.ok(!('availableMW' in r),'空容量は載せない');}
 // 北海道は区間番号で対応（高見線は送84・83・82）
 for(const no of ['82','83','84'])assert.equal(d.lines['hokkaido-section-'+no]?.no,no);
 const cat=read('scripts/prepare-foundation.mjs'.replace('scripts/prepare-foundation.mjs','public/data/catalog.json'));const ds=cat.datasets.find((x:any)=>x.id==='line-capacity');
 assert.equal(ds?.distribution,'private-preview');
});
test('facility tiers follow the approved definition (A 国の地図で確認 / B 公表名一致 / C 地図のみ / D 位置推定)',()=>{
 const osm='https://www.openstreetmap.org/way/1';
 assert.equal(facilityTierOf({url:'https://example.jp/addr'}),'D');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'位置の根拠',value:'住所の代表点'}]}),'D');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'要注意（位置）',value:'提供された座標'}]}),'D');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'位置の確認',value:'国土地理院の地図注記'}]}),'A');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'位置の確認',value:'注記'},{label:'要注意（C区分）',value:'x'}]}),'C');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'名称・位置の根拠',value:'無名区画'}]}),'C');
 assert.equal(facilityTierOf({url:osm,attributes:[{label:'OSM登録',value:'名称：岩手変電所'}]}),'B');
 const counts:Record<string,number>={};const seen=new Set<string>();
 for(const f of ['tohoku-trunk','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'])for(const x of read(`public/data/${f}.json`).facilities){if(seen.has(x.id))continue;seen.add(x.id);const t=facilityTierOf(x);counts[t]=(counts[t]??0)+1;}
 assert.ok(counts.A>0&&counts.B>0&&counts.C>0&&counts.D>0,JSON.stringify(counts));
});
test('OCCTO Kansai capacities written as 「A⇒B」 in one field are split and matched (were all dropped before 2026-10-09)',async()=>{
 const {reviewedKansaiDay}=await import('../src/kansai-domain.ts');
 // 運用容量が OCCTO で未公表（YA000010SW）の日は容量なしで載る（保留27、2026-10-25。約1か月前の日は容量が取れない）ので、容量のあるいちばん古い日で確かめる
 const f=read('public/data/kansai-flow.json');const withCap=f.days.filter((x:any)=>x.capacities.length);assert.ok(withCap.length,'容量のある日がない');const d=reviewedKansaiDay(withCap.at(-1));
 assert.ok(d.capacities.length>=30,String(d.capacities.length));
 const h=d.capacities.find((c:any)=>c.name==='播磨線');assert.equal(h?.from,'北摂変電所');assert.equal(h?.to,'西播変電所');
});
test('plant units (段階③): only primary-source plants, running units sum to the recorded total, ended/under-construction units are listed but excluded',()=>{
 const p=read('public/data/plant-profiles.json').records;
 const withUnits=p.filter((r:any)=>r.units);assert.ok(withUnits.length>=9);
 for(const r of withUnits){assert.ok(r.unitsSource?.url?.startsWith('https://'),r.name);const run=r.units.filter((u:any)=>u.status==='運転中').reduce((s:number,u:any)=>s+u.mw,0);if(r.capacityBasis!=='建設計画出力')assert.equal(run,r.capacityMW,r.name);}
 const onagawa=p.find((r:any)=>r.name==='女川原子力発電所');assert.deepEqual(onagawa.units.filter((u:any)=>u.status!=='運転中').map((u:any)=>u.name),['1号']);
 const oma=p.find((r:any)=>r.name==='大間原子力発電所');assert.ok(oma.units.every((u:any)=>u.status==='建設中'));
});
test('HJKS plant units (2026-10-09): public dataset with attribution, ended units excluded from running totals, no zero-output units',()=>{
 const d=read('public/data/plant-units.json');assert.equal(d.schemaVersion,1);assert.match(d.source.name,/発電情報公開システム/);assert.equal(d.source.url,'https://hjks.jepx.or.jp/hjks/');
 const ps=Object.values<any>(d.plants);assert.ok(ps.length>=100,String(ps.length));
 for(const p of ps)for(const u of p.units){assert.ok(u.mw>0);assert.ok(['運転中','運転終了'].includes(u.status));if(u.status==='運転終了')assert.ok(u.end&&u.end<=d.retrievedAt);}
 const onagawa=d.plants['osm-way-1341021071'].units;assert.equal(onagawa.filter((u:any)=>u.status==='運転中').reduce((s:number,u:any)=>s+u.mw,0),1650);
 const cat=read('public/data/catalog.json').datasets.find((x:any)=>x.id==='plant-units');assert.ok(cat&&cat.distribution!=='private-preview');
});
