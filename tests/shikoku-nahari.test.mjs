// 四国の奈半利川・坂出・西条火力・大川・鳴門淡路の線（2026-11-10 オーナー承認 保留107、scripts/shikoku-nahari.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('public/data/shikoku-trunk.json', 'utf8'));
const line = n => { const l = d.lines.filter(x => x.name === n); assert.equal(l.length, 1, n); return l[0]; };
const ends = l => l.connections.map(c => c.facilities[0]?.name ?? null);
const tier = l => l.attributes.find(a => a.label === '照合区分')?.value;

test('新しい線・直した線の両端と照合区分', () => {
  const want = {
    長山線: ['新改変電所', '長山発電所'], 奈半利川支線: [null, '奈半利川変電所'], 二又線: ['二又水力発電所', '奈半利川変電所'], 魚梁瀬線: ['魚梁瀬発電所', '二又水力発電所'],
    大川支線: [null, '大川変電所'], 壬生川線: ['壬生川変電所', '西条火力変電所'], 西条火力線: ['西条火力変電所', '西条変電所'],
    讃岐坂出線: ['坂出火力発電所', '讃岐変電所'], 坂出火力線: ['坂出火力発電所', '香川変電所'], 香川線: ['讃岐変電所', '香川変電所'], 鳴門淡路線: ['鳴門変電所', '西淡変電所'],
  };
  for (const [n, e] of Object.entries(want)) { const l = line(n); assert.deepEqual(ends(l), e, n); assert.equal(tier(l), 'C区分', n); }
  for (const n of ['二又水力発電所の連系線', '西条発電所の連系線', '坂出火力発電所の連系線', '讃岐坂出線（推定）']) assert.ok(!d.lines.some(l => l.name === n), n + ' が残っている');
  assert.ok(!line('讃岐坂出線').attributes.some(a => a.label === '推定の内容'), '讃岐坂出線の推定の表示を外す');
});

test('二又線は長山線の No.1 を通るだけで、つながない（交差・近接を接続にしない）', () => {
  const no1 = line('奈半利川支線').connections[0];
  assert.equal(no1.status, 'shared-node'); assert.equal(no1.node, 7874840884);
  for (const n of ['二又線', '長山線']) assert.ok(!line(n).connections.some(c => c.node === no1.node), n + ' の端が No.1 になっている');
});

test('鳴門淡路線：淡路側の OSM の地中ケーブル3線分だけを点線にする', () => {
  const l = line('鳴門淡路線');
  assert.deepEqual(l.cableOsmIds, [1037463535, 1037463534, 1037463533]);
  for (const id of l.cableOsmIds) assert.ok(l.osmIds.includes(id));
});

test('新改幹線・新改高知線は新改変電所に着き、OCCTO の「新改PS」の当て先も新改変電所', () => {
  for (const n of ['新改幹線', '新改高知線']) assert.ok(ends(line(n)).includes('新改変電所'), n);
  const pairs = fs.readFileSync('src/shikoku-pairs.ts', 'utf8');
  assert.ok(!pairs.includes('新改発電所')); assert.equal((pairs.match(/'新改PS'/g) ?? []).length, 2);
  for (const n of ['新改発電所', '西条発電所']) assert.match(d.facilities.find(f => f.name === n).attributes.find(a => a.label === '系統との接続').value, /直接つながるとみなした（推測/);
});

test('付け替えで使わなくなった OSM の線分は、記録した1本（伊新線と思われる way 789804061）だけ', () => {
  const used = new Set(d.lines.flatMap(l => l.osmIds));
  for (const id of [844182803, 844182798, 620976979, 1037448452, 87538343, 88161482, 987107164, 102958892, 102958918, 102958890, 1104430576, 1104430577, 1104430578]) assert.ok(used.has(id), 'way ' + id);
  assert.ok(!used.has(789804061));
});

test('大川支線は国土地理院の記号をなぞった1区間（仮ID）で、讃岐鳴門線の頂点から分かれる', () => {
  const l = line('大川支線');
  assert.deepEqual(l.osmIds, [-1235469190]);
  const sn = line('讃岐鳴門線'), b = l.paths[0][0];
  assert.ok(sn.paths.some(p => p.some(q => q[0] === b[0] && q[1] === b[1])), '分岐点が讃岐鳴門線の上にない');
});

test('地中の線分（OSM power=cable）は点線にする：香川線の東回りのトンネル区間', () => {
  assert.deepEqual(line('香川線').cableOsmIds, [102958918, 1104430576]);
  const fac = d.facilities.find(f => f.name === '大川変電所');
  assert.ok(!fac.attributes.some(a => a.label.startsWith('要注意')), '大川変電所は公表名と OSM の区画名が一致（B）');
});
