import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';import {isCaution} from '../src/line-drawing.ts';
// 確度 C・D・E の線は詳細欄・一覧に「要注意」と表示（2026-11-03 保留67、2026-11-07 保留82 で線の濃さは A・B と同じに、保留85 で見方の説明とツールチップの表示を削除）：要注意の線と、読み込み後の確度 C・D・E が全線で一致すること
test('要注意の線と確度 C・D・E が一致する',()=>{
 const cat=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));const odd:string[]=[];let n=0;
 for(const d of cat.datasets){const f='public/data/'+String(d.url).replace(/^\.\/(data\/)?/,'').split('?')[0];if(!f.endsWith('.json')||!fs.existsSync(f))continue;let j:any;try{j=JSON.parse(fs.readFileSync(f,'utf8'));}catch{odd.push(`${d.id} 読めない`);continue;}
  for(const l of j.lines??[]){n++;const tier=evidenceOf(l).tier;if(isCaution(l)!==(tier==='C'||tier==='D'||tier==='E'))odd.push(`${d.id} ${l.name} ${tier??'未判定'}`);}}
 assert.ok(n>500,'線が読めていない');assert.deepEqual(odd,[]);
});
