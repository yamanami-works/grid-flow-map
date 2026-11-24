// 2026-11-02 セキュリティレビュー E：連系線潮流実績の取得（scripts/fetch-occto-tie.mjs）。ネットワークは使わず、偽の fetch で応答を返す。書き込みは一時フォルダだけ
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchOcctoTie} from '../scripts/fetch-occto-tie.mjs';
import {tieTime, TIE_ROWS} from '../scripts/tie-csv.mjs';

// Shift_JIS に変換する（Node には符号化がないので、2バイトの並びを復号して対応表を作る）
const sjisMap = (() => { const m = new Map(), dec = new TextDecoder('shift_jis');
  for (let a = 0x81; a <= 0xfc; a++) for (let b = 0x40; b <= 0xfc; b++) { const ch = dec.decode(new Uint8Array([a, b])); if (ch.length === 1 && !m.has(ch)) m.set(ch, [a, b]); }
  return m; })();
const sjis = s => Uint8Array.from([...s].flatMap(c => c.charCodeAt(0) < 0x80 ? [c.charCodeAt(0)] : sjisMap.get(c)));
const HEAD = '連系線,対象日付,対象時刻,運用容量(順方向),運用容量(逆方向),広域調整枠(順方向),広域調整枠(逆方向),マージン(順方向),マージン(逆方向),空容量(順方向),空容量(逆方向),計画潮流(順方向),計画潮流(逆方向),潮流実績,運用容量拡大分(順方向),運用容量拡大分(逆方向)';
const goodCsv = (f = i => tieTime(i)) => [HEAD, ...Array.from({length: TIE_ROWS}, (_, i) => ['本四連系線', '2026/11/02', f(i), 1200, -1200, 0, 0, 0, 0, 0, 0, 0, 0, -1000, 0, 0].join(','))].join('\r\n') + '\r\n';
const search = JSON.stringify({root: {errMessage: [], bizRoot: {header: {spcDayHdn: {value: 'd'}, sntkTgtRklCdHdn: {value: 'c'}, searchReqHdn: {value: '本四連系線'}, updDaytime: {value: 'u'}}}}});
const ok = JSON.stringify({root: {errMessage: [], bizRoot: {header: {downloadKey: {value: 'k'}, requestToken: {value: 't'}}}}});

/** 応答の列を順に返す偽の fetch。各要素は Response を作る関数 */
function fake(list) { const calls = []; return {calls, fetchImpl: async (url, init) => { calls.push({url, init}); const f = list.shift(); assert.ok(f, 'unexpected request ' + url); return f(); }}; }
const res = (body, status = 200) => () => new Response(body, {status});
const login = [res('<html>'), res('<html>')];
const run = async (list, codes = ['09']) => { const dir = mkdtempSync(join(tmpdir(), 'tie-')), f = fake(list);
  try { const files = await fetchOcctoTie({date: '2026-11-02', codes, dir, fetchImpl: f.fetchImpl, wait: async () => {}, log: () => {}}); return {files, dir, calls: f.calls}; }
  catch (e) { rmSync(dir, {recursive: true, force: true}); throw e; } };

test('連系線の取得：正常なら CSV を UTF-8 で保存し、sha256 は保存した文字列から（以前と同じ）。転送は付いて行かない指定', async () => {
  const text = goodCsv(), {files, dir, calls} = await run([...login, res(search), res(ok), res(sjis(text))]);
  try {
    assert.equal(readFileSync(join(dir, '09.csv'), 'utf8'), text);
    assert.equal(files[0].sha256, createHash('sha256').update(text).digest('hex'));
    assert.equal(files[0].rows, 288);
    assert.ok(existsSync(join(dir, 'source.json')));
    assert.ok(calls.every(c => c.init.redirect === 'manual' && c.url.startsWith('https://')));
    assert.equal(calls[2].init.headers['User-Agent'], 'powerflow-site research (local)');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
test('連系線の取得：転送・500・形式違いの CSV はログインからやり直して1回だけ再試行し、それでもだめなら失敗（保存しない）', async () => {
  const twice = bad => [...login, res(search), res(ok), bad, ...login, res(search), res(ok), bad];
  await assert.rejects(run(twice(() => new Response(null, {status: 302, headers: {location: 'https://elsewhere.test/'}}))), /redirected/);
  await assert.rejects(run(twice(res('', 500))), /HTTP 500/);
  await assert.rejects(run(twice(res(sjis(goodCsv(i => i === 50 ? tieTime(51) : tieTime(i)))))), /out of order/);
  await assert.rejects(run(twice(res('<html>error</html>'))), /download failed/);
});
test('連系線の取得：1回目が失敗しても再試行で正常なら保存する。要求の回数は線ごとに最大2回', async () => {
  const text = goodCsv(), {dir, calls} = await run([...login, res(search), res(ok), res('', 503), ...login, res(search), res(ok), res(sjis(text))]);
  try { assert.equal(readFileSync(join(dir, '09.csv'), 'utf8'), text); assert.equal(calls.length, 10); }
  finally { rmSync(dir, {recursive: true, force: true}); }
});
test('連系線の取得：ログインで受けた Cookie を後の要求に付け、再試行では新しい session で古い Cookie を送らない', async () => {
  const text = goodCsv(), withCookie = (c, body = '<html>') => () => new Response(body, {status: 200, headers: {'set-cookie': c}});
  const {dir, calls} = await run([withCookie('S=one'), res('<html>'), res(search), res(ok), res('', 503), withCookie('S=two'), res('<html>'), res(search), res(ok), res(sjis(text))]);
  try {
    assert.equal(calls[2].init.headers.Cookie, 'S=one');
    assert.equal(calls[5].init.headers.Cookie, undefined, '再試行のログインは Cookie なしで始める');
    assert.equal(calls[8].init.headers.Cookie, 'S=two');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
