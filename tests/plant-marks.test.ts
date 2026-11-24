import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';
// 2026-10-17 オーナー指示（五井火力発電所のマークが火力にならなかった件の再発防止、docs/RULES.md 3節）：
// 発電所を足した・直したあとに tools/build-plant-sources.mjs を実行し忘れると、地図のマーク（src/plant-sources.ts）から漏れる。
const FILES=['tohoku-trunk','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'];
// マークを決められない発電所（画面は「不明」の茶色の丸）。足すときは理由を書く
const UNKNOWN:Record<string,string>={};
test('every plant on the map has a mark in src/plant-sources.ts or is listed as unknown with a reason',()=>{
 const ts=readFileSync('src/plant-sources.ts','utf8'),keys=new Set([...ts.matchAll(/^\s+"([^"]+)": '/gm)].map(m=>m[1]));
 const missing:string[]=[];
 for(const f of FILES)for(const x of JSON.parse(readFileSync(`public/data/${f}.json`,'utf8')).facilities.filter((x:any)=>x.kind==='plant'))if(!keys.has(x.id)&&!UNKNOWN[x.id])missing.push(`${f} ${x.id} ${x.name}`);
 assert.deepEqual(missing,[],'マークのない発電所：node tools/build-plant-sources.mjs を実行する（決められないものは UNKNOWN に理由を書く）');
});
test('src/plant-sources.ts matches a fresh run of tools/build-plant-sources.mjs (needs data/raw)',(t)=>{
 if(!existsSync('data/raw/tokyo-275')){t.skip('data/raw がない');return;}
 assert.doesNotThrow(()=>execFileSync(process.execPath,['tools/build-plant-sources.mjs','--check'],{stdio:'pipe'}),'作り直しが必要：node tools/build-plant-sources.mjs');
});
test('marks follow the primary source (発電方式（一次資料） / HJKS) first',()=>{
 const b=JSON.parse(readFileSync('docs/research/plant-sources-basis.json','utf8')).plants;
 assert.equal(b['osm-way-605327351']?.source,'thermal');assert.equal(b['osm-way-605327351']?.basis,'primary');
 // 「発電方式（一次資料）」がなく HJKS の発電形式だけで決まる例（中部電力 碧南火力発電所、HJKS は全ユニット火力（石炭））。
 // 2026-10-18 に高見発電所→奥只見発電所→碧南火力発電所と差し替えた。水力は一次資料の形式を足すと例から外れたので、
 // HJKS だけで種別（石炭）が決まる発電所を例に選んだ
 assert.deepEqual(b['osm-way-101926129'],{source:'thermal',basis:'primary',why:'HJKSの発電形式'});
 for(const f of FILES)for(const x of JSON.parse(readFileSync(`public/data/${f}.json`,'utf8')).facilities.filter((x:any)=>x.kind==='plant'&&x.attributes?.some((a:any)=>a.label==='発電方式（一次資料）')))assert.equal(b[x.id]?.basis,'primary',x.id+' '+x.name);
});
