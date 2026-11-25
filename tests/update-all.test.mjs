// scripts/update-all.mjs の終了コードと警告の文（2026-11-25 保留155）。一部の手順の失敗では配置を止めず、全部失敗のときだけ止める。
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

const lockBefore = existsSync('tmp/update-all.lock');
const {exitCodeFor, warningLine} = await import('../scripts/update-all.mjs');

test('読み込んだだけでは実行しない（ロックを作らない）', () => {
  assert.equal(existsSync('tmp/update-all.lock'), lockBefore);
});

test('終了コード：全部成功・一部失敗は0、全部失敗・空は1', () => {
  const ok = step => ({step, ok: true}), ng = step => ({step, ok: false, message: 'Command failed'});
  assert.equal(exitCodeFor([ok('update-occto'), ok('update-ties')]), 0);
  assert.equal(exitCodeFor([ok('update-occto'), ng('update-chugoku'), ok('update-ties')]), 0);
  assert.equal(exitCodeFor([ng('update-occto'), ng('update-ties')]), 1);
  assert.equal(exitCodeFor([]), 1);
});

test('警告の文：::warning:: で始まる1行。改行と「::」を除き、本文は200字以内', () => {
  const w = warningLine({step: 'update-chugoku', ok: false, message: 'Command failed\r\n::error::x' + 'あ'.repeat(300)});
  assert.match(w, /^::warning::取得失敗（前回分のまま。次の実行で取り直す）：update-chugoku：Command failed error/);
  assert.ok(!/[\r\n]/.test(w));
  assert.equal(w.split('::').length, 3, '先頭の ::warning:: のほかに「::」がない');
  const body = w.slice(w.indexOf('：update-chugoku') + 1);
  assert.ok(body.length <= 200, String(body.length));
  assert.match(warningLine({step: 'update-ties', ok: false}), /：update-ties：$/);
});
