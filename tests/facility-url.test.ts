// 2026-11-18 オーナー指示「御母衣第二発電所のタグ表示がでないので出るようにして。」：url のない設備（OSM の区画がなく位置推定で置いた *-place-* など）を開くと
// 詳細パネルの処理が f.url.includes で止まり、前の表示が残っていた。url がなくても動くこと（src/real.ts の facilityView・出典の行）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('詳細パネルは url のない設備でも止まらない',()=>{
 const src=readFileSync('src/real.ts','utf8');
 assert.ok(!/\bf\.url\.(includes|startsWith)\(/.test(src),'f.url を直接 includes している箇所がある');
 assert.match(readFileSync('src/real-domain.ts','utf8'),/url\?: string;/);
 // url のない設備が実際にある（この不具合が起きる対象）
 const n=['kansai','tokyo','chugoku','kyushu'].flatMap(r=>JSON.parse(readFileSync(`public/data/${r}-trunk.json`,'utf8')).facilities).filter((f:any)=>typeof f.url!=='string').length;
 assert.ok(n>0);
});
