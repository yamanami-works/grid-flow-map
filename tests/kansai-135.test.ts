// 保留135（2026-11-19 オーナー回答「図のとおり進めて」）。No.37・40 の始まりは保留136（回答「(c)は②」）で南姫路変電所に移した：姫路まわりの描き直し（scripts/kansai-135.mjs）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';
const read=(f:string)=>JSON.parse(readFileSync('public/data/'+f,'utf8'));
const k=read('kansai-trunk.json'),L=(id:string)=>k.lines.find((x:any)=>x.id===id),key=(q:number[])=>q.join(',');
const pts=(l:any)=>new Set(l.paths.flat().map(key));
test('No.36〜41 の線名と両端',()=>{
 const ends=(l:any)=>l.connections.map((c:any)=>c.facilities[0]?.name??c.status);
 assert.deepEqual([L('kansai-plant-275-way-364849743').name,...ends(L('kansai-plant-275-way-364849743'))],['送電線（No.36）（推定）','姫路第一発電所','新加古川変電所']);
 assert.deepEqual([L('kansai-275-gsi-姫路第二接続').name,...ends(L('kansai-275-gsi-姫路第二接続'))],['送電線（No.37）（推定）','南姫路変電所','shared-node']);
 assert.deepEqual([L('ledger-infer-kansai-275-326003634').name,...ends(L('ledger-infer-kansai-275-326003634'))],['姫路支線（推定）','shared-node','姫路変電所']);
 assert.deepEqual([L('ledger-infer-kansai-275-185027449').name,...ends(L('ledger-infer-kansai-275-185027449'))],['送電線（No.40）（推定）','南姫路変電所','宝塚開閉所']);
 assert.deepEqual([L('ledger-infer-kansai-275-798170173').name,...ends(L('ledger-infer-kansai-275-798170173'))],['姫路南支線（推定）','姫路変電所','shared-node']);
 assert.deepEqual([L('ledger-infer-kansai-275-1085722956').name,L('ledger-infer-kansai-275-1085722956').paths.length],['No.36・No.40 の接続線（推測）',1]);
 // No.36 を名乗る線は1本だけ。公表の行 No.36〜41 はそれぞれ1本
 assert.equal(k.lines.filter((l:any)=>/No\.36）/.test(l.name)).length,1);
 for(const no of ['36','37','38','40','41'])assert.equal(k.lines.filter((l:any)=>l.attributes.some((a:any)=>a.label==='公表の行'&&new RegExp(` No\.${no}：`).test(a.value))).length,1,'No.'+no);
 assert.ok(!L('ledger-infer-kansai-275-1085722956').attributes.some((a:any)=>a.label==='公表の行'));
});
test('No.41 は P27 で No.36 とつながらず、No.40 の上の点 X で終わる',()=>{
 const l41=L('ledger-infer-kansai-275-798170173'),l36=L('kansai-plant-275-way-364849743'),l40=L('ledger-infer-kansai-275-185027449');
 const s36=pts(l36);assert.ok(!l41.paths.flat().some((q:number[])=>s36.has(key(q))),'No.41 と No.36 は座標を共有しない');
 const X=l41.connections[1].position;assert.ok(l40.paths.some((p:any)=>p.slice(1,-1).some((q:number[])=>key(q)===key(X))),'X は No.40 の途中の点');
 for(const l of [l41,l40,l36,L('kansai-275-gsi-姫路第二接続'),L('ledger-infer-kansai-275-1085722956')]){assert.equal(evidenceOf(l).tier,'C');assert.ok(evidenceOf(l).inferred.length>0,l.name);}
});
test('No.37 は No.36 の点 P8 に、K7 は P30・P29 につながる',()=>{
 const l37=L('kansai-275-gsi-姫路第二接続'),l36=L('kansai-plant-275-way-364849743'),k7=L('ledger-infer-kansai-275-1085722956'),l40=L('ledger-infer-kansai-275-185027449');
 assert.ok(pts(l36).has(key(l37.paths.at(-1).at(-1))));
 assert.ok(pts(l36).has(key(k7.paths[0][0])));assert.ok(pts(l40).has(key(k7.paths[0].at(-1))));
 const u=read('undrawn-sections.json');const rows=u.rows??Object.values(u).find(Array.isArray);assert.ok(!rows.some((r:any)=>r.region==='kansai'&&r.no==='40'));
});
