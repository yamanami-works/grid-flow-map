// 2026-11-24 日別の潮流データの照合（src/flow-hash.ts）と、手元のサーバーが日別ファイルを加工せずに返すこと
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import {createServer} from 'node:http';
import {verifiedDay} from '../src/flow-hash.ts';
import {hashOf} from '../scripts/flow-split.mjs';
import {isDayFile} from '../scripts/compact-response.mjs';
import {liveDataMiddleware} from '../scripts/live-data.mjs';

const bytesOf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

test('verifiedDay：一覧の hash と合えば中身を返し、1バイトでも違えば失敗、SHA-256 が使えなければ失敗', async () => {
  const text = JSON.stringify({date: '2026-11-01', x: [1.5, 2]});
  assert.deepEqual(await verifiedDay(bytesOf(text), hashOf(text)), {date: '2026-11-01', x: [1.5, 2]});
  await assert.rejects(verifiedDay(bytesOf(text.replace('1.5', '1.6')), hashOf(text)), /hash mismatch/);
  await assert.rejects(verifiedDay(bytesOf(' ' + text), hashOf(text)), /hash mismatch/, '空白だけの違い（縮めた応答など）も採らない');
  await assert.rejects(verifiedDay(bytesOf(text), hashOf(text), null), /unavailable/);
});

test('isDayFile：日別ファイルのパスだけ', () => {
  for (const p of ['/data/tokyo-flow-days/2026-11-01.json', '/data/occto-tohoku-days/2026-10-30.json']) assert.ok(isDayFile(p), p);
  for (const p of ['/data/tokyo-flow-latest.json', '/data/tokyo-flow.json', '/data/catalog.json', '/data/tokyo-flow-days/x.json']) assert.ok(!isDayFile(p), p);
});

test('画面の読み込み（ensureFlowDate）は受け取ったバイト列を照合し、r.json() で読まない', () => {
  const src = fs.readFileSync('src/real.ts', 'utf8'), body = src.slice(src.indexOf('function ensureFlowDate('), src.indexOf('function selectFlowDate('));
  assert.ok(body.includes('verifiedDay(await r.arrayBuffer(),e.hash)'));
  assert.ok(!body.includes('r.json()'));
});

// 開発サーバー・携帯用プレビューのデータの処理（live-data）：日別ファイルは縮めずに返し、一覧の hash と合う
const dayFiles = () => {
  const cat = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
  const out: {path: string, hash: string}[] = [];
  for (const d of cat.datasets.filter((x: {id: string}) => /-flow-latest$/.test(x.id))) {
    const latest = 'public/' + d.url.slice(2); if (!fs.existsSync(latest)) continue;
    const e = JSON.parse(fs.readFileSync(latest, 'utf8')).index?.[1]; if (e) out.push({path: '/' + d.url.slice(2).replace(/-latest\.json$/, '-days/') + e.date + '.json', hash: e.hash});
  }
  return out;
};
test('live-data は日別ファイルを加工せずに返す（gzip を展開したバイト列が hash と合う）', {skip: !dayFiles().length && '潮流の日別ファイルがない'}, async t => {
  const mw = liveDataMiddleware(process.cwd(), async () => {}, false);
  const server = createServer((req, res) => mw(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  for (const f of dayFiles()) {
    const r = await fetch(base + f.path, {headers: {'accept-encoding': 'gzip'}});
    assert.equal(r.status, 200, f.path);
    assert.equal(hashOf(Buffer.from(await r.arrayBuffer())), f.hash, f.path);
  }
});
