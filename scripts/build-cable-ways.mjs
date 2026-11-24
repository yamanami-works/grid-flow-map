// 取得原本（data/raw 以下のOSM応答）から地中・海底送電線（power=cable）の way ID を一覧化する。
// 原本はGit管理外のため、一覧 data/catalog/cable-ways.json をリポジトリで保持し、ビルドはこの一覧を使う。
import fs from 'node:fs';
import path from 'node:path';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ids = new Set(), sources = [];
for (const f of walk('data/raw').filter(f => f.endsWith('.json') && !/occto|source\.json$/.test(f))) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  if (!Array.isArray(j.elements)) continue;
  const n = ids.size; for (const e of j.elements) if (e.type === 'way' && e.tags?.power === 'cable') ids.add(e.id);
  if (ids.size > n) sources.push(f.split(path.sep).join('/'));
}
fs.writeFileSync('data/catalog/cable-ways.json', JSON.stringify({ note: 'OSMで power=cable（地中・海底送電線）と登録された way ID。画面では該当区間を点線で描く。', generatedAt: new Date().toISOString().slice(0, 10), sources, wayIds: [...ids].sort((a, b) => a - b) }, null, 2) + '\n');
console.log('cable ways', ids.size, 'from', sources.length, 'files');
