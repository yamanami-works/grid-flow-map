// 2026-11-24 応答の大きさの上限（scripts/read-limited.mjs）：読みながら数えて、超えたらその場で止める。
// 読み戻し（restore-flows）と原子力の運転状態（fetch-nra-status）の取得もこれを使う。外部には接続しない（偽の応答と手元のサーバーだけ）
import test from 'node:test'; import assert from 'node:assert/strict';
import http from 'node:http'; import {gzipSync} from 'node:zlib';
import {readLimited} from '../scripts/read-limited.mjs';
import {get as restoreGet} from '../scripts/restore-flows.mjs';
import {get as nraGet} from '../scripts/fetch-nra-status.mjs';

const stream = (chunks, size) => { let n = 0; const s = new ReadableStream({pull(c) { if (n >= chunks) c.close(); else { n++; c.enqueue(new Uint8Array(size)); } }}); return {s, read: () => n}; };

test('上限ちょうどは通り、1バイトでも超えれば失敗。Content-Length がなくても途中で止まる', async () => {
  assert.equal((await readLimited(new Response(new Uint8Array(8)), 8)).length, 8);
  await assert.rejects(readLimited(new Response(new Uint8Array(9)), 8), /too large/);
  const big = stream(100, 1024);
  await assert.rejects(readLimited(new Response(big.s), 4096), /too large/);
  assert.ok(big.read() < 10, '超えたところで読むのをやめる（' + big.read() + '）');
});

test('Content-Length が小さくても実際に超えれば失敗、大きければ読む前に失敗', async () => {
  const lie = stream(100, 1024), r = new Response(lie.s, {headers: {'content-length': '10'}});
  await assert.rejects(readLimited(r, 4096), /too large/);
  let pulled = false; const body = new ReadableStream({pull() { pulled = true; }});
  await assert.rejects(readLimited(new Response(body, {headers: {'content-length': '99999'}}), 4096), /too large/);
  assert.equal(pulled, false, '本体を読まない');
});

test('gzip は展開した後の大きさで数える（手元のサーバー）', async t => {
  const plain = Buffer.alloc(64 * 1024, 0x20), gz = gzipSync(plain);
  const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Encoding': 'gzip', 'Content-Length': gz.length}); res.end(gz); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/`;
  assert.ok(gz.length < 4096);
  await assert.rejects(readLimited(await fetch(url), 4096), /too large/);
  assert.equal((await readLimited(await fetch(url), plain.length)).length, plain.length);
});

test('読み戻しと原子力の運転状態の取得も、読みながら上限で止める', async () => {
  const fake = body => async () => new Response(body, {status: 200});
  const a = stream(100, 1024);
  await assert.rejects(restoreGet(fake(a.s), 'https://example.test/a.json', 4096), /大きすぎる/);
  assert.ok(a.read() < 10);
  assert.equal((await restoreGet(fake(new Uint8Array(4096)), 'https://example.test/a.json', 4096)).bytes.length, 4096);
  const b = stream(100, 1024);
  await assert.rejects(nraGet('https://example.test/b', {fetchImpl: fake(b.s), maxBytes: 4096}), /大きすぎる/);
  assert.ok(b.read() < 10);
  assert.equal((await nraGet('https://example.test/b', {fetchImpl: fake(new Uint8Array(4096)), maxBytes: 4096})).length, 4096);
  // 途中で切れた応答は、大きさの誤りに書き換えずにそのまま失敗する（不完全なデータを採らない）
  const broken = new ReadableStream({pull(c) { c.error(Error('connection reset')); }});
  await assert.rejects(nraGet('https://example.test/c', {fetchImpl: fake(broken)}), /connection reset/);
});

test('超過の例外には code TOO_LARGE が付く（呼び出し側は文の中身でなく code で見分ける）', async () => {
  await assert.rejects(readLimited(new Response(new Uint8Array(9)), 8), e => e.code === 'TOO_LARGE');
});
