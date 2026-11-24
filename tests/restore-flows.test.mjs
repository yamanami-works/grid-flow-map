// 2026-11-01 公開残件3-B：前回分の読み戻し（scripts/restore-flows.mjs）。ネットワークは使わない（偽の fetch）
import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp, mkdir, copyFile, readFile, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreFlows, checkBase, sha256} from '../scripts/restore-flows.mjs';
import {SPLIT_FLOWS} from '../scripts/flow-split.mjs';

const BASE = 'https://example.github.io/grid-map/', TODAY = '2026-11-01';
const day = date => ({date, actual: {times: Array.from({length: 48}, (_, i) => `${date}T${String(i >> 1).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`), lines: [{id: 'a', values: Array(48).fill(1)}]}, capacities: []});
const local = JSON.parse(await readFile(new URL('../public/data/catalog.json', import.meta.url), 'utf8'));
const schemaOf = name => local.datasets.find(d => d.url === `./data/${name}.json`).schemaVersion;

async function rootDir() {
  const root = await mkdtemp(join(tmpdir(), 'grid-restore-'));
  await mkdir(join(root, 'public/data'), {recursive: true});
  await copyFile(new URL('../public/data/catalog.json', import.meta.url), join(root, 'public/data/catalog.json'));
  return root;
}
/** 公開中のサイトの形（公開物のカタログに sha256） */
function site({hash = true} = {}) {
  const files = {};
  for (const name of SPLIT_FLOWS) files[`data/${name}.json`] = Buffer.from(JSON.stringify({schemaVersion: schemaOf(name), days: [day('2026-11-01'), day('2026-10-31'), day('2026-09-01')], updatedAt: 'x'}));
  const datasets = local.datasets.map(d => d.purpose === 'flow' && hash && files[d.url.slice(2)] ? {...d, sha256: sha256(files[d.url.slice(2)])} : d);
  files['data/catalog.json'] = Buffer.from(JSON.stringify({...local, datasets}));
  return files;
}
function fakeFetch(files, calls = []) {
  return async (url, opts) => {
    calls.push({url, opts});
    const u = new URL(url), key = u.pathname.replace('/grid-map/', '');
    assert.ok(u.searchParams.has('t'), 'キャッシュ回避の ?t=');
    if (!(key in files)) return new Response('no', {status: 404});
    const v = files[key];
    return typeof v === 'number' ? new Response('', {status: v}) : new Response(v, {status: 200});
  };
}
const run = (root, files, extra = {}) => restoreFlows({base: BASE, fetchImpl: fakeFetch(files), root, today: TODAY, interval: 0, log: () => {}, ...extra});
const written = async root => (await readdir(join(root, 'public/data'))).filter(f => f !== 'catalog.json');

test('正常：10データを受け取ったバイト列のまま書き、東北の日別は30日の窓の中だけ書く', async () => {
  const root = await rootDir(), files = site(), calls = [];
  const r = await restoreFlows({base: BASE, fetchImpl: fakeFetch(files, calls), root, today: TODAY, interval: 0, log: () => {}});
  assert.equal(r.restored.length, 10);
  for (const name of SPLIT_FLOWS) assert.deepEqual(await readFile(join(root, `public/data/${name}.json`)), files[`data/${name}.json`]);
  assert.deepEqual((await readdir(join(root, 'public/data/occto'))).sort(), ['2026-10-31.json', '2026-11-01.json'], '窓の外（09-01）は書かない');
  assert.equal(await readFile(join(root, 'public/data/occto/2026-11-01.json'), 'utf8'), JSON.stringify(day('2026-11-01')));
  assert.ok(calls.every(c => c.opts.redirect === 'manual' && c.opts.signal), '転送は失敗・上限時間つき');
  assert.equal(calls.length, 11);
});
test('sha256 の不一致・形式の誤り・schemaVersion の違いは何も書かずに失敗（--initial でも）', async () => {
  for (const [label, edit] of [
    ['不一致', f => { f['data/tokyo-flow.json'] = Buffer.from(f['data/tokyo-flow.json'].toString().replace('"x"', '"y"')); }],
    ['形式', f => { const b = Buffer.from(JSON.stringify({schemaVersion: schemaOf('tie-flow'), days: [{date: '2026-11-01'}]})); f['data/tie-flow.json'] = b; const c = JSON.parse(f['data/catalog.json']); c.datasets.find(d => d.url === './data/tie-flow.json').sha256 = sha256(b); f['data/catalog.json'] = Buffer.from(JSON.stringify(c)); }],
    ['schemaVersion', f => { const c = JSON.parse(f['data/catalog.json']); c.datasets.find(d => d.url === './data/kyushu-flow.json').schemaVersion = 99; f['data/catalog.json'] = Buffer.from(JSON.stringify(c)); }],
    ['url', f => { const c = JSON.parse(f['data/catalog.json']); c.datasets.find(d => d.url === './data/kyushu-flow.json').url = './data/../evil.json'; f['data/catalog.json'] = Buffer.from(JSON.stringify(c)); }],
  ]) for (const initial of [false, true]) {
    const root = await rootDir(), files = site(); edit(files);
    await assert.rejects(run(root, files, {initial}), undefined, label);
    assert.deepEqual(await written(root), [], label + '：何も書かない');
  }
});
test('カタログがない（404）・sha256 がない：--initial のときだけ何も書かずに成功', async () => {
  const none = {};
  await assert.rejects(run(await rootDir(), none), /カタログがない/);
  assert.equal((await run(await rootDir(), none, {initial: true})).initial, true);
  const noHash = site({hash: false});
  await assert.rejects(run(await rootDir(), noHash), /sha256/);
  const root = await rootDir();
  assert.equal((await run(root, noHash, {initial: true})).initial, true);
  assert.deepEqual(await written(root), []);
  const partial = site(), c = JSON.parse(partial['data/catalog.json']);
  delete c.datasets.find(d => d.url === './data/tie-flow.json').sha256; partial['data/catalog.json'] = Buffer.from(JSON.stringify(c));
  await assert.rejects(run(await rootDir(), partial, {initial: true}), /sha256/, '一部だけ sha256 がないのは --initial でも失敗');
});
test('転送・HTTP の誤り・データの欠けは何も書かずに失敗', async () => {
  for (const [key, v] of [['data/catalog.json', 301], ['data/catalog.json', 500], ['data/chubu-flow.json', 302], ['data/chubu-flow.json', 503]]) {
    const root = await rootDir(), files = site(); files[key] = v;
    await assert.rejects(run(root, files, {initial: true}), /HTTP/);
    assert.deepEqual(await written(root), []);
  }
  const root = await rootDir(), files = site(); delete files['data/hokuriku-flow.json'];
  await assert.rejects(run(root, files, {initial: true}), /読み戻せない/);
  assert.equal(existsSync(join(root, 'public/data/occto')), false);
});
test('サイトの URL：https で / で終わるものだけ', () => {
  assert.equal(checkBase(BASE), BASE);
  for (const bad of ['http://example.github.io/grid-map/', 'https://example.github.io/grid-map', 'https://u:p@example.github.io/', 'https://example.github.io/?a=1', 'file:///c:/', 'grid-map/']) assert.throws(() => checkBase(bad), undefined, bad);
});

// 2026-11-24：大きさの上限は読みながら確かめ、超えたらその場で止める（全体を読み終えるのを待たない）。何も書かずに失敗する
test('Content-Length のない巨大な応答は途中で読むのをやめ、何も書かずに失敗', async () => {
  let pulls = 0;
  const huge = new ReadableStream({pull(c) { pulls++; if (pulls > 64) c.close(); else c.enqueue(new Uint8Array(1024 * 1024)); }});
  const root = await rootDir(), files = site(); files['data/chubu-flow.json'] = huge;
  await assert.rejects(run(root, files), /大きすぎる/);
  assert.ok(pulls < 40, '32MiB を超えたところで止まる（読んだ回数 ' + pulls + '）');
  assert.deepEqual(await written(root), []);
});
