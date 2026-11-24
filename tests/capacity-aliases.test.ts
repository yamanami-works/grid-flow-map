import test from 'node:test';import assert from 'node:assert/strict';
import {alignCapacities,CAPACITY_ALIASES} from '../src/capacity-aliases.ts';
// 2026-10-10 オーナー承認：容量表と実績で書き方だけが違う行の対応表。フェンス（複数線の合計）と99999以上（設定なし）は入れない
test('対応表にフェンスの行がない',()=>{for(const l of Object.values(CAPACITY_ALIASES))for(const a of l)assert.doesNotMatch(a[0],/フェンス/);});
test('容量の行を実績の書き方にそろえる',()=>{const [a]=CAPACITY_ALIASES.shikoku;const d=alignCapacities('shikoku',{capacities:[{name:a[0],from:a[1],to:a[2],voltageKV:187,capacityMW:1}]});
 assert.deepEqual([d.capacities[0].name,d.capacities[0].from,d.capacities[0].to],[a[3],a[4],a[5]]);});
test('対応表にないエリアはそのまま',()=>{const day={capacities:[{name:'X',from:'a',to:'b'}]};assert.deepEqual(alignCapacities('hokkaido',day),day);});
test('（他社）の行は全エリアで excluded（2026-10-10）',()=>{for(const r of ['tokyo','chubu','hokkaido']){const d=alignCapacities(r,{capacities:[{name:'西南多摩線（他社）',from:'西東京',to:'多摩'}]});assert.ok(d.capacities[0].excluded);}});
test('東京 港北線（港北→西東京）は excluded',()=>{const d=alignCapacities('tokyo',{capacities:[{name:'港北線',from:'港北',to:'西東京'},{name:'横浜港北線',from:'横浜大黒',to:'港北'}]});assert.ok(d.capacities[0].excluded);assert.equal(d.capacities[1].excluded,undefined);});
test('対応表に（他社）の行がない',()=>{for(const l of Object.values(CAPACITY_ALIASES))for(const a of l)assert.doesNotMatch(a[0],/他社/);});
