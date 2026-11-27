// 現在地ボタン（src/locate.ts。2026-11-26。規則は docs/RULES.md 5節「個人情報」）
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import * as mod from '../src/locate-core.ts';
const src = readFileSync(new URL('../src/locate.ts', import.meta.url), 'utf8');

test('範囲：日本の主な地点は内、海外は外', () => {
  for (const [lat, lng] of [[35.68, 139.76], [43.06, 141.35], [26.21, 127.68], [24.34, 124.16], [27.09, 142.19], [45.52, 141.94], [34.2, 129.3], [32.72, 132.99], [24.28, 153.98], [33.11, 139.79], [43.4, 145.8], [42.15, 139.45], [32.7, 128.84]]) assert.equal(mod.inJapan(lat, lng), true, `${lat},${lng}`);
  for (const [lat, lng] of [[37.57, 126.98], [35.10, 129.04], [37.48, 130.87], [34.65, 128.65], [33.5, 126.53], [43.12, 131.89], [46.6, 142.8], [25.03, 121.56], [51.5, -0.12], [40.7, -74.0], [0, 0], [NaN, 139]]) assert.equal(mod.inJapan(lat, lng), false, `${lat},${lng}`);
});

test('エラーの区分と決まった文', () => {
  assert.equal(mod.errorResult(1), 'denied'); assert.equal(mod.errorResult(2), 'unavailable'); assert.equal(mod.errorResult(3), 'timeout'); assert.equal(mod.errorResult(9), 'unavailable');
  assert.deepEqual(Object.keys(mod.LOCATE_MESSAGES).sort(), ['denied', 'outside', 'timeout', 'unavailable']);
  assert.doesNotMatch(src, /err\.message|\.message\b/, 'ブラウザのエラー文を出さない');
});

test('使える環境：安全な接続で位置情報に対応しているときだけ', () => {
  assert.equal(mod.canLocate({isSecureContext: true, navigator: {geolocation: {}}}), true);
  assert.equal(mod.canLocate({isSecureContext: false, navigator: {geolocation: {}}}), false);
  assert.equal(mod.canLocate({isSecureContext: true, navigator: {}}), false);
});

test('取得は押したときに1回だけ、保存・送信をしない', () => {
  assert.match(src, /button\.onclick = \(\) => \{[\s\S]*getCurrentPosition/);
  assert.equal((src.match(/getCurrentPosition/g) || []).length, 1);
  assert.doesNotMatch(src, /watchPosition|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|history\.|location\.(hash|search|href)|document\.cookie/);
  assert.deepEqual(mod.LOCATE_OPTIONS, {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
  assert.match(src, /if \(busy\) return;/, '連打で重ねて取得しない');
  assert.equal((src.match(/interactive: false/g) || []).length, 2, '点と円は線のタップを邪魔しない');
  const real = readFileSync(new URL('../src/real.ts', import.meta.url), 'utf8');
  assert.equal((real.match(/geolocation/g) || []).length, 0, '起動時などほかの場所で位置を取らない');
  assert.match(real, /<button id="real-locate" class="icon-button" aria-label="現在地へ移動"[^>]* hidden>/);
  assert.match(real, /<div id="real-locate-notice" class="locate-notice" role="status" aria-live="polite" hidden><\/div>/);
});

test('非表示の指定が CSS で打ち消されない', () => {
  const css = readFileSync(new URL('../src/real.css', import.meta.url), 'utf8');
  assert.match(css, /\.map-controls #real-locate\[hidden\]\{display:none\}/);
  assert.match(css, /\.real-workspace \.locate-notice\[hidden\]\{display:none\}/);
});

test('確認用サーバーは自サイトだけに位置情報を許可', () => {
  const s = readFileSync(new URL('../scripts/preview-server.mjs', import.meta.url), 'utf8');
  assert.match(s, /'Permissions-Policy','camera=\(\), microphone=\(\), geolocation=\(self\)'/);
});

test('プライバシー表示がある', async () => {
  const legal = readFileSync(new URL('../src/legal.ts', import.meta.url), 'utf8');
  assert.match(legal, /「現在地」ボタンを押したときだけ、端末から1回取得/);
  assert.match(legal, /「現在地」ボタンで取得した位置は、端末の中で地図の移動と点の表示だけに使い/);
});
