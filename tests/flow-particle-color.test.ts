// 潮流の粒子の塗り：容量不明は止まった粒子（0 MW）も動く粒子も凡例と同じ明るい灰（2026-11-07 オーナー指示）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const real = readFileSync('src/real.ts', 'utf8');

test('容量不明の粒子は止まっていても凡例と同じ灰（#d3d9de）で塗り、濃い灰 colors.unknown を使わない', () => {
  assert.match(real, /const fill=usageBand==='unknown'\?'#d3d9de':color;/);
  assert.match(real, /particles\.push\(still\?\{latlngs:oriented as \[number,number\]\[\],color:fill,weight:pw,still,/);
  assert.match(real, /:\{latlngs:oriented as \[number,number\]\[\],color:fill,weight:pw,\.\.\.\(usageBand==='unknown'\?\{edge:\{color:'#2f3a44'/);
  // 凡例の「容量不明」と同じ塗り・縁
  assert.match(real, /FLOW_KEY_DOT\('#d3d9de','2px solid #2f3a44'\)\+'容量不明/);
});
