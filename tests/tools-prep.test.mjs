// 2026-10-12 root の tools/ から app/tools/prep/ へ移したデータ準備の道具：移動前のパス（'../app'・'../reports'・root を '..' で指すもの）が残っていないこと
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
import {prepSkip} from './raw-data.mjs';
const DIR = 'tools/prep';
// tools/prep は公開リポジトリに入れない。公開リポジトリの Actions でないときだけ飛ばす（2026-11-01 保留45）
const skip = prepSkip(DIR);
const files = skip ? [] : fs.readdirSync(DIR).filter(f => f.endsWith('.mjs')).map(f => path.join(DIR, f)).concat('tools/watch-flows.sh');

test('tools/prep にデータ準備の道具が入っている', {skip}, () => { assert.ok(files.length >= 57, '本数 ' + files.length); });

test("移動前のパス（'../app'・'../reports'・root の '..'）が残っていない", {skip}, () => {
  const bad = [];
  for (const f of files) fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/['"`]\.\.\/(app|reports)\b|import\.meta\.dirname, '\.\.'\)|\/\.\.\/app["/]/.test(line)) bad.push(`${f}:${i + 1}`);
  });
  assert.deepEqual(bad, []);
});

test('相対の import 先がすべてある', {skip}, () => {
  for (const f of files.filter(f => f.endsWith('.mjs'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/from '(\.{1,2}\/[^']+)'/g))
    assert.ok(fs.existsSync(path.join(path.dirname(f), m[1])), `${f} → ${m[1]}`);
});
