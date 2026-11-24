// 2026-10-11 需要家の対象電圧（tools/lib/customer-target.mjs、docs/RULES.md 3節「需要家」の1）
import test from 'node:test'; import assert from 'node:assert/strict';
import {isCustomerTargetKV} from '../tools/lib/customer-target.mjs';
test('需要家の対象電圧：全国500/275kV、北海道187kV、中国・九州220kV、四国187kV', () => {
  for (const a of ['tohoku', 'tokyo', 'chubu', 'hokuriku', 'kansai', 'hokkaido', 'chugoku', 'shikoku', 'kyushu']) for (const kv of [500, 275]) assert.ok(isCustomerTargetKV([a], kv), a + ' ' + kv);
  assert.ok(isCustomerTargetKV(['hokkaido'], 187)); assert.ok(isCustomerTargetKV(['shikoku'], 187));
  assert.ok(isCustomerTargetKV(['chugoku'], 220)); assert.ok(isCustomerTargetKV(['kyushu'], 220));
  for (const [a, kv] of [['tokyo', 154], ['tokyo', 187], ['tohoku', 154], ['kansai', 220], ['chubu', 154], ['hokkaido', 220], ['hokkaido', 110], ['chugoku', 187], ['kyushu', 187], ['shikoku', 220], ['shikoku', 154]]) assert.equal(isCustomerTargetKV([a], kv), false, a + ' ' + kv);
  assert.ok(isCustomerTargetKV(['tokyo', 'kyushu'], 220), '複数地域はどれかの地域で対象');
  assert.equal(isCustomerTargetKV(undefined, 154), false);
});
