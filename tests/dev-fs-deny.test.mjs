// 開発サーバーが配信しない場所（vite.config.ts の server.fs.deny、docs/RULES.md 5節）。判定だけを見る：ファイルは読まず、待ち受けもしない（2026-11-02 保留51）
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer, isFileServingAllowed} from 'vite';

test('開発サーバー：data/private・data/raw・tmp・.git・docs/research は配信せず、src は配信する', async () => {
  const server = await createServer({configFile: 'vite.config.ts', server: {middlewareMode: true, hmr: false}, logLevel: 'silent'});
  try {
    const root = process.cwd().split(path.sep).join('/'), allowed = p => isFileServingAllowed(root + '/' + p, server);
    for (const p of ['data/private/x.json', 'data/private/sub/y.json', 'Data/Private/x.json', 'data/raw/x.json', 'data/validation/x.json', 'tmp/x.json', '.git/config', 'docs/research/x.json', '.env'])
      assert.equal(allowed(p), false, p);
    assert.equal(allowed('src/main.ts'), true);
  } finally { await server.close(); }
});
