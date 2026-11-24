// ⓘ（収録データと照合状況）の「確度の説明」：折りたたみの比較表。公開に不要な語・件数を入れない（2026-11-07 オーナー指示）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const real = readFileSync('src/real.ts', 'utf8');
const m = real.match(/<details class="tier-compare">[\s\S]*?<\/details>/);

test('確度の欄に「確度の説明」の折りたたみがあり、#tier-info の外に置く', () => {
  assert.ok(m, '確度の説明がない');
  assert.ok(real.includes('<div id="tier-info" class="small-copy"></div><details class="tier-compare"><summary>確度の説明</summary>'));
  assert.equal((m![0].match(/<table>/g) ?? []).length, 2);
  assert.match(m![0], /<b>送電線<\/b>/);
  assert.match(m![0], /<b>変電所・発電所など<\/b>/);
});

test('公開に不要な語・件数・危ない書き方を含まない', () => {
  const s = m![0];
  assert.doesNotMatch(s, /\.md|src\/|docs\/|オーナー|原則\d|\d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(s, /\d+\s*(本|件)/);
  assert.doesNotMatch(s, /style=|\son[a-z]+=|\$\{|`/);
  // 要注意の札は送電線だけ（設備には出していない）
  assert.match(s, /確度 C・D・E の送電線は、一覧と詳細に「要注意」と表示します/);
  assert.doesNotMatch(s, /線・設備は「要注意」/);
});

test('確度の模式図：送電線・設備で各5つ（svg・figure が10）、外部の読み込みや小さすぎる文字がない', () => {
  const s = m![0];
  assert.equal((s.match(/<svg /g) ?? []).length, 10);
  assert.equal((s.match(/<figure>/g) ?? []).length, 10);
  assert.equal((s.match(/class="tier-schem"/g) ?? []).length, 2);
  assert.doesNotMatch(s, /<script|http|xmlns|<image|<use|href=/i);
  assert.doesNotMatch(s, /font-size="([0-9]|10)(\.\d+)?"/);
  for (const t of ['A', 'B', 'C', 'D', 'E']) {
    assert.match(s, new RegExp(`aria-label="送電線の確度${t}の模式図"`));
    assert.match(s, new RegExp(`aria-label="設備の確度${t}の模式図"`));
  }
});
