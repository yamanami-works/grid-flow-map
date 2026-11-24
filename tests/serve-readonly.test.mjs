// 2026-10-12 テスト用マップ（tools/serve-readonly.mjs）：カタログから携帯用だけのデータを除き、カタログにあるデータはすべて配信できること
// 2026-11-24：公開リポジトリの CI（publicCheckout）では、test が build（prepare-foundation が携帯用の項目を外す）より前に動くため、元のカタログに携帯用の項目があるかは問わない。
// 配信されるカタログに1件もないことの検査はどちらでも行い、除外の働きは publicCatalog の単体テスト（最初のテスト）でも確かめている。
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import {spawn} from 'node:child_process'; import http from 'node:http';
import {publicCatalog} from '../tools/lib/public-catalog.mjs';
import {publicCheckout} from './raw-data.mjs';
import {hashOf} from '../scripts/flow-split.mjs';

test('publicCatalog は携帯用だけのデータを除き、ほかはそのまま', () => {
  const raw = {schemaVersion: 1, version: 'x', datasets: [{id: 'a', url: './data/a.json'}, {id: 'b', url: './data/b.json', distribution: 'private-preview'}]};
  assert.deepEqual(publicCatalog(raw), {schemaVersion: 1, version: 'x', datasets: [{id: 'a', url: './data/a.json'}]});
});

test('配信されるカタログに携帯用だけのデータ（line-capacity・substation-voltages）がなく、載っているデータは 404 にならない', async () => {
  const raw = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
  // 公開リポジトリの CI では test が build（prepare-foundation）より前に動き、元のカタログに携帯用の項目が残ることがあるので有無を問わない（配信されるカタログに1件もないことは下で確かめる）
  if (!publicCheckout()) assert.ok(raw.datasets.some(d => d.distribution === 'private-preview'), '元のカタログには携帯用だけのデータがある');
  const port = 18700 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ['tools/serve-readonly.mjs', '.', String(port), '--no-memo'], {stdio: ['ignore', 'pipe', 'inherit']});
  try {
    await new Promise((res, rej) => { server.stdout.on('data', d => String(d).includes('listening') && res()); server.on('exit', c => rej(Error('exit ' + c))); });
    const base = `http://127.0.0.1:${port}`;
    const catalog = await (await fetch(base + '/data/catalog.json')).json();
    const ids = catalog.datasets.map(d => d.id);
    for (const id of ['line-capacity', 'substation-voltages']) assert.ok(!ids.includes(id), id);
    assert.ok(catalog.datasets.every(d => d.distribution !== 'private-preview'));
    assert.equal(catalog.datasets.length, raw.datasets.filter(d => d.distribution !== 'private-preview').length);
    for (const d of catalog.datasets.filter(d => fs.existsSync('public/' + d.url.slice(2)))) {
      const r = await fetch(base + '/' + d.url.slice(2), {method: 'HEAD'});
      assert.equal(r.status, 200, d.url);
    }
    for (const f of ['line-capacity', 'substation-voltages']) assert.equal((await fetch(`${base}/data/${f}.json`)).status, 404, f);
    // 2026-11-24：Host が 127.0.0.1／localhost のポートでなければ 403（DNS リバインディング対策）
    const status = host => new Promise((res, rej) => http.get({host: '127.0.0.1', port, path: '/data/catalog.json', headers: {host}}, r => { r.resume(); res(r.statusCode); }).on('error', rej));
    assert.equal(await status(`evil.example:${port}`), 403);
    assert.equal(await status(`127.0.0.1:${port + 1}`), 403);
    assert.equal(await status(`localhost:${port}`), 200);
    assert.equal(await status(`127.0.0.1:${port}`), 200);
    // 2026-11-24：潮流の日別ファイルは縮めずに返す（画面がハッシュを照合するため）。gzip を展開したバイト列が一覧の hash と合う
    for (const d of catalog.datasets.filter(d => /-flow-latest$/.test(d.id) && fs.existsSync('public/' + d.url.slice(2)))) {
      const e = JSON.parse(fs.readFileSync('public/' + d.url.slice(2), 'utf8')).index?.[1]; if (!e) continue;
      const r = await fetch(`${base}/${d.url.slice(2).replace(/-latest\.json$/, '-days/')}${e.date}.json`, {headers: {'accept-encoding': 'gzip'}});
      assert.equal(hashOf(Buffer.from(await r.arrayBuffer())), e.hash, d.id);
    }
  } finally { server.kill(); }
});
