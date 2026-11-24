// 2026-10-31 公開残件2：OCCTO 地内実績・運用容量の取得（scripts/fetch-occto.mjs、fetch-occto.ps1 の Node 版）の判定と要求。ネットワークは使わない
import test from 'node:test'; import assert from 'node:assert/strict';
import {judge, parseBody, sha256Upper, session, retryOnce, retryable, readLimited, MAX_BYTES, EMPTY_CAPACITY} from '../scripts/fetch-occto.mjs';

const ok = (rows = [{a: 1}], totalPage = '1') => ({root: {bizRoot: {table: {table1: {table1: {totalPage, rows}}}}}});
const err = (...ids) => ({root: {errMessage: ids.map(msgId => ({msgId}))}});

test('判定：正常な応答は ok', () => {
  assert.equal(judge(ok(), {kind: 'actual'}), 'ok');
  assert.equal(judge({root: {errMessage: [], bizRoot: ok().root.bizRoot}}, {kind: 'actual'}), 'ok', '誤りの配列が空なら誤りではない');
});
test('判定：運用容量の未公表（YA000010SW）は許すときだけ empty', () => {
  assert.equal(judge(err(EMPTY_CAPACITY), {kind: 'capacity', allowEmptyCapacity: true}), 'empty');
  assert.throws(() => judge(err(EMPTY_CAPACITY), {kind: 'capacity'}));
  assert.throws(() => judge(err(EMPTY_CAPACITY), {kind: 'actual', allowEmptyCapacity: true}), '実績では許さない');
  assert.throws(() => judge(err(EMPTY_CAPACITY, 'XX000001E'), {kind: 'capacity', allowEmptyCapacity: true}), 'ほかの誤りが混じれば失敗');
});
test('判定：ほかの誤り・複数ページ・行なし・形の違う応答は失敗', () => {
  assert.throws(() => judge(err('XX000001E'), {kind: 'actual'}));
  assert.throws(() => judge(ok([{a: 1}], '2'), {kind: 'actual'}));
  assert.throws(() => judge(ok([]), {kind: 'actual'}));
  assert.throws(() => judge({}, {kind: 'actual'}));
});
test('応答の読み取り：BOM を外して読み、JSON でなければ失敗。sha256 はバイト列から大文字16進', () => {
  assert.deepEqual(parseBody(Buffer.from('\uFEFF{"a":1}')), {a: 1});
  assert.throws(() => parseBody(Buffer.from('<html>error</html>')), /not JSON/);
  assert.equal(sha256Upper(Buffer.from('abc')), 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
});

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({url, init}); const r = responses.shift();
    return {status: r.status ?? 200, ok: (r.status ?? 200) < 300, headers: {getSetCookie: () => r.cookies ?? []}, arrayBuffer: async () => new TextEncoder().encode(r.body ?? '{}').buffer}; };
  return {fetchImpl, calls};
}
test('要求：Cookie を引き継ぎ（値の = を切らない）、転送・HTTP の誤り・HTTPS 以外は失敗', async () => {
  const {fetchImpl, calls} = fakeFetch([{cookies: ['JSESSIONID=abc==; Path=/; Secure', 'x=1']}, {body: '{"b":2}'}]);
  const request = session({fetchImpl, wait: async () => {}});
  await request('https://example.test/a');
  assert.equal((await request('https://example.test/b', {k: 'v'}, true)).toString(), '{"b":2}');
  assert.equal(calls[1].init.headers.Cookie, 'JSESSIONID=abc==; x=1');
  assert.equal(calls[1].init.headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(calls[1].init.redirect, 'manual');
  assert.equal(calls[1].init.body, 'k=v');
  await assert.rejects(session({fetchImpl: fakeFetch([{status: 302}]).fetchImpl})('https://example.test/'), /redirected/);
  await assert.rejects(session({fetchImpl: fakeFetch([{status: 500}, {status: 500}]).fetchImpl, wait: async () => {}, log: () => {}})('https://example.test/'), /HTTP 500/);
  await assert.rejects(session({fetchImpl: fakeFetch([{}]).fetchImpl})('http://example.test/'), /HTTPS only/);
});
test('要求：getSetCookie がない Node では失敗し、要求の間をあける', async () => {
  const noCookie = async () => ({status: 200, ok: true, headers: {}, arrayBuffer: async () => new ArrayBuffer(0)});
  await assert.rejects(session({fetchImpl: noCookie})('https://example.test/'), /getSetCookie/);
  const waits = [], {fetchImpl} = fakeFetch([{}, {}]);
  const request = session({fetchImpl, wait: async ms => { waits.push(ms); }, intervalMs: 1000});
  await request('https://example.test/1'); await request('https://example.test/2');
  assert.equal(waits.length, 1); assert.ok(waits[0] > 900 && waits[0] <= 1000);
});
// 2026-10-31 公開残件3-A：再試行は接続の失敗と 5xx のときだけ、1回まで
const connErr = code => Object.assign(new TypeError('fetch failed'), {cause: {code}});
test('再試行：5xx と接続の失敗は1回だけ送り直し、4xx・ほかの誤りは送り直さない', async () => {
  const opts = {wait: async () => {}, log: () => {}};
  let n = 0; assert.equal((await retryOnce(async () => ({status: ++n === 1 ? 503 : 200}), opts)).status, 200); assert.equal(n, 2);
  n = 0; assert.equal((await retryOnce(async () => ({status: (++n, 500)}), opts)).status, 500); assert.equal(n, 2, '2回目の 5xx はそのまま返す');
  n = 0; assert.equal((await retryOnce(async () => ({status: (++n, 404)}), opts)).status, 404); assert.equal(n, 1);
  n = 0; assert.equal((await retryOnce(async () => { if (++n === 1) throw connErr('UND_ERR_CONNECT_TIMEOUT'); return {status: 200}; }, opts)).status, 200); assert.equal(n, 2);
  n = 0; await assert.rejects(retryOnce(async () => { ++n; throw connErr('ECONNRESET'); }, opts)); assert.equal(n, 2, '2回目の失敗はそのまま投げる');
  for (const e of [connErr('CERT_HAS_EXPIRED'), connErr('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), Object.assign(new Error('timeout'), {name: 'TimeoutError'})]) {
    n = 0; await assert.rejects(retryOnce(async () => { ++n; throw e; }, opts)); assert.equal(n, 1, String(e.cause?.code ?? e.name)); assert.equal(retryable(e), false);
  }
});
test('再試行：session でも 5xx を1回だけ送り直し、待つ時間は再試行の間隔', async () => {
  const waits = [], {fetchImpl, calls} = fakeFetch([{status: 502}, {body: '{"ok":1}'}]);
  const request = session({fetchImpl, wait: async ms => { waits.push(ms); }, retryDelayMs: 5000, log: () => {}});
  assert.equal((await request('https://example.test/x')).toString(), '{"ok":1}');
  assert.equal(calls.length, 2); assert.deepEqual(waits, [5000]);
  await assert.rejects(session({fetchImpl: fakeFetch([{status: 302}, {}]).fetchImpl, wait: async () => {}, log: () => {}})('https://example.test/'), /redirected/, '転送は送り直さない');
});
// 2026-11-02 セキュリティレビュー E：応答の大きさの上限と、再試行を切る指定
test('要求：応答が大きさの上限を超えたら失敗（Content-Length で読まずに、なければ読みながら）', async () => {
  const big = new Uint8Array(2048);
  const withLength = async () => new Response(big, {status: 200, headers: {'content-length': '2048'}});
  await assert.rejects(session({fetchImpl: withLength, maxBytes: 1024})('https://example.test/'), /too large/);
  let cancelled = false;
  const streamed = async () => new Response(new ReadableStream({pull(c) { c.enqueue(new Uint8Array(512)); }, cancel() { cancelled = true; }}), {status: 200});
  await assert.rejects(session({fetchImpl: streamed, maxBytes: 1024})('https://example.test/'), /too large/);
  assert.ok(cancelled, '読むのをやめる');
  const small = async () => new Response('{"a":1}', {status: 200});
  assert.equal((await session({fetchImpl: small, maxBytes: 1024})('https://example.test/')).toString(), '{"a":1}');
  assert.equal((await readLimited(await small(), 7)).toString(), '{"a":1}', 'ちょうど上限は通る');
  await assert.rejects(readLimited({headers: {}, arrayBuffer: async () => new ArrayBuffer(9)}, 8), /too large/, 'body のない応答も長さで判定');
  assert.equal(MAX_BYTES, 5 * 1024 * 1024);
});
test('要求：retry:false なら 5xx を送り直さず失敗する', async () => {
  const {fetchImpl, calls} = fakeFetch([{status: 503}, {}]);
  await assert.rejects(session({fetchImpl, wait: async () => {}, retry: false})('https://example.test/'), /HTTP 503/);
  assert.equal(calls.length, 1);
});
