import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';import path from 'node:path';import {publicText} from '../scripts/public-wording.mjs';
// 設備の代表点（2026-10-16 オーナー承認）：OSMの区画の頂点の平均が区画の外に落ちる設備は、区画の内側の点へ移す（docs/research/facility-points.json、広野火力は gap-completions）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const FILES=['tohoku-trunk','tohoku-dc-osm','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'];
const REGION:any={tokyo:'tokyo-trunk',chubu:'chubu-trunk',shikoku:'shikoku-trunk'};
const inside=(p:number[],g:number[][])=>{let c=false;for(let i=0,j=g.length-1;i<g.length;j=i++){const[yi,xi]=g[i],[yj,xj]=g[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
test('facility points from the table are applied once, and (with the raw OSM) lie inside their areas',()=>{
 const t=read('docs/research/facility-points.json');assert.equal(t.entries.length,4);
 for(const e of t.entries){const f=read(`public/data/${REGION[e.region]}.json`).facilities.find((x:any)=>x.id===e.facilityId);assert.ok(f&&f.name===e.name,e.name);
  assert.deepEqual(f.position,e.newPosition,e.name);const a=f.attributes.filter((x:any)=>x.label==='代表点の取り方');assert.equal(a.length,1,e.name);assert.equal(a[0].value,publicText(e.note),e.name);
  assert.ok(!f.attributes.some((x:any)=>x.label==='位置の根拠'),e.name);
  if(!existsSync(e.raw))continue;const els=read(e.raw).elements,w=els.find((x:any)=>x.type==='way'&&x.id===e.way);
  const nodes=new Map(els.filter((x:any)=>x.type==='node').map((x:any)=>[x.id,[x.lat,x.lon]]));const g=w.geometry?w.geometry.map((q:any)=>[q.lat,q.lon]):w.nodes.map((n:number)=>nodes.get(n));
  assert.ok(inside(f.position,g),e.name+' inside');assert.ok(!inside(e.oldPosition,g),e.name+' old point was outside');}
});
// 全国：OSMの閉じた区画（way）がある設備の代表点が、区画の外に落ちていないこと（原本 data/raw がある環境だけ。公開リポジトリにはない）。
// 複数の地域に同じIDで入る設備は、最初のファイルのものだけを見る（補正は地域ごとに当てるので、同じIDの設備は同じ座標になる）
test('no facility point with a closed OSM way area lies outside it (only where the raw OSM is available)',()=>{
 if(!existsSync('data/raw'))return;
 const want=new Set<number>();const facs:any[]=[];const seen=new Set();
 for(const f of FILES){for(const x of read(`public/data/${f}.json`).facilities){if(seen.has(x.id))continue;seen.add(x.id);const m=String(x.url??'').match(/openstreetmap\.org\/way\/(\d+)/);if(m){want.add(+m[1]);facs.push({x,way:+m[1],file:f});}}}
 const polys=new Map<number,number[][]>(),wn=new Map<number,number[]>(),nodes=new Map<number,number[]>();
 const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(/occto|hjks|tso-lines|network-capacity|change-plans|gsi/.test(e.name))continue;walk(p);}else if(e.name.endsWith('.json')&&statSync(p).size<200e6){const s=readFileSync(p,'utf8');if(!s.includes('"elements"'))continue;let j:any;try{j=JSON.parse(s);}catch{continue;}if(!Array.isArray(j?.elements))continue;
  for(const x of j.elements){if(x.type==='node')nodes.set(x.id,[x.lat,x.lon]);else if(x.type==='way'&&want.has(x.id)){if(x.geometry&&!polys.has(x.id))polys.set(x.id,x.geometry.map((q:any)=>[q.lat,q.lon]));else if(x.nodes&&!wn.has(x.id))wn.set(x.id,x.nodes);}}}}};
 walk('data/raw');for(const [id,ns] of wn)if(!polys.has(id)){const g=ns.map(n=>nodes.get(n));if(g.every(Boolean))polys.set(id,g as number[][]);}
 const out=[];for(const {x,way,file} of facs){const g=polys.get(way);if(!g||g.length<4)continue;const closed=g[0][0]===g.at(-1)![0]&&g[0][1]===g.at(-1)![1];if(!closed)continue;if(!inside(x.position,g))out.push(file+':'+x.name);}
 const checked=facs.filter(({way})=>{const g=polys.get(way);return g&&g.length>=4&&g[0][0]===g.at(-1)![0]&&g[0][1]===g.at(-1)![1];}).length;assert.ok(checked>=500,'点検した設備が少なすぎる：'+checked);
 assert.deepEqual(out,[],'代表点が区画の外：'+out.join('、'));
});
