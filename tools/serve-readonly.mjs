// Read-only static server: dist + public/data (+ 宮城の data/validation) (no update scripts, no writes). 127.0.0.1 だけで待ち受ける。
// 2026-11-24：Host が 127.0.0.1:<ポート> か localhost:<ポート> でない要求は 403（DNS リバインディングで外部のページから宮城の限定検証のデータなどを読まれないように）。
// 2026-10-10：root の tools/ から app/tools/ へ移した（Git の管理下）。既定の配信元は app。
// 使い方：node tools/serve-readonly.mjs [配信元（既定 app）] [ポート（既定 8766）] [--no-memo] [--dist <フォルダ>]
import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {publicCatalog} from './lib/public-catalog.mjs';

const proj = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, '..');
// --dist <フォルダ>：画面（dist）だけ別のビルドを使う（改善前のコードを同じデータで比べる用）。データは proj/public のまま
const distAt = process.argv.indexOf('--dist'), dist = distAt > 0 ? path.resolve(process.argv[distAt + 1]) : path.join(proj, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

// 地域データは public/data（catalog）へ移した（2026-10-03）。/validation/ は宮城の限定検証だけ
const validation = {
  '/validation/miyagi-ishinomaki.json': 'data/validation/miyagi-ishinomaki.json',
};
const regionStatus = /^\/data\/(hokkaido|tokyo|chubu|hokuriku|kansai|chugoku|shikoku|kyushu|tie)-status\.json$/;

// 許可リスト方式（2026-10-11 オーナー承認、scripts/preview-server.mjs と同じ考え方）：配信してよいパスだけを決めて返す。それ以外はすべて 404。
// 画面＝dist の index.html と assets/ のビルド成果物。データ＝public/data/catalog.json に登録された公開データ（携帯用だけのデータは除く）と、
// 潮流の1日分のファイル（<名前>-days/<日付>.json、<名前>-latest.json が登録されているもの）。更新状態は tmp/ の決まったファイルだけ。
// 照合は大文字小文字を区別した完全一致なので、/.GIT/・8.3 形式の短い名前・末尾のドット・::$DATA などは一致しない。最後に実体のパスが配信元の中にあることも確かめる。
const ASSET = /^\/assets\/[A-Za-z0-9_-]+\.(?:js|css|png|svg|woff2)$/;
const DAY = /^\/data\/([a-z]+(?:-[a-z]+)*)-days\/\d{4}-\d{2}-\d{2}\.json$/;
async function publicData() {
  const allowed = new Set(['/data/catalog.json', '/data/connection-gaps.json', '/data/LICENSE.txt']);
  const catalog = JSON.parse(await readFile(path.join(proj, 'public/data/catalog.json'), 'utf8'));
  for (const d of catalog.datasets) if (d.access === 'public' && d.distribution !== 'private-preview' && /^\.\/data\/[a-z0-9-]+\.json$/.test(d.url)) allowed.add('/' + d.url.slice(2));
  return allowed;
}
async function resolveFile(p) {
  const inside = async (base, file) => { const real = await realpath(file).catch(() => null), root = await realpath(base).catch(() => null); return real && root && real.startsWith(root + path.sep) ? real : null; };
  if (p === '/' || p === '/index.html') return inside(dist, path.join(dist, 'index.html'));
  if (ASSET.test(p)) return inside(dist, path.join(dist, p));
  if (validation[p]) return inside(path.join(proj, 'data/validation'), path.join(proj, validation[p]));
  // 状態ファイルは手元で取得の状態を確かめる用に残す。画面は 2026-11-09（保留92）から読まない（更新の状態は最新の観測で決める）
  if (p === '/data/occto-status.json') return inside(path.join(proj, 'tmp'), path.join(proj, 'tmp/occto-status.json'));
  const st = p.match(regionStatus); if (st) return inside(path.join(proj, 'tmp'), path.join(proj, `tmp/${st[1]}-status.json`));
  const data = await publicData(), day = p.match(DAY);
  if (data.has(p) || day && data.has(`/data/${day[1]}-latest.json`)) return inside(path.join(proj, 'public/data'), path.join(proj, 'public', p));
  return null;
}

// 2026-10-10 表示速度の改善：縮小（JSON）・gzip した結果を、ファイルの更新時刻と大きさが変わるまでメモリに保持して使い回す（毎回の読み込み・縮小・圧縮をやめる）
const prepared = new Map(), NO_MEMO = process.argv.includes('--no-memo'); // --no-memo：使い回さない（計測で改善前と比べる用）
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
async function prepare(file, p, gzip) {
  const s = await stat(file), key = file + '|' + (gzip ? 'gz' : 'id');
  const hit = prepared.get(key); if (!NO_MEMO && hit && hit.mtimeMs === s.mtimeMs && hit.size === s.size) return hit;
  let body = await readFile(file);
  // カタログは携帯用だけのデータを除いて渡す（除かないと画面がそれを読みに行き 404 になる。2026-10-12）
  if (p === '/data/catalog.json') body = Buffer.from(JSON.stringify(publicCatalog(JSON.parse(body.toString('utf8')))));
  const version = createHash('sha256').update(body).digest('hex').slice(0, 12);
  const type = types[path.extname(file)] ?? 'application/octet-stream';
  // Same response compaction as the app's preview (JSON map data minified/rounded). The Miyagi pilot is byte-verified, so it is not compacted.
  // 潮流の日別ファイルも画面がハッシュを照合するので縮めない（2026-11-24）
  if (path.extname(file) === '.json' && !p.endsWith('miyagi-ishinomaki.json') && !DAY.test(p)) { const { compactJson } = await import(pathToFileURL(path.join(proj, 'scripts/compact-response.mjs')).href).catch(() => ({})); if (compactJson) body = compactJson(body); }
  const encoded = gzip && body.length > 1024 && COMPRESSIBLE.test(type);
  const out = { mtimeMs: s.mtimeMs, size: s.size, type, version, body: encoded ? gzipSync(body, { level: 6 }) : body, gzip: encoded };
  prepared.set(key, out); return out;
}

const port = Number(process.argv[3] ?? 8766), hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
http.createServer(async (req, res) => {
  if (!hosts.has(req.headers.host)) { res.writeHead(403); res.end('forbidden host'); return; }
  // URL の解読はエラー処理の内側で行う。壊れた URL（例 /%E0%A4%A）は 400 を返し、サーバーは止まらない（2026-10-11）
  let u, p;
  try { u = new URL(req.url, 'http://x'); p = decodeURIComponent(u.pathname); } catch { res.writeHead(400); res.end('bad request'); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const file = await resolveFile(p);
    if (!file) throw 0;
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const r = await prepare(file, p, gzip);
    // ?v= がファイルの中身のハッシュ（先頭12桁）と同じ時だけキャッシュさせる。ビルドせずにデータだけ作り直した時（カタログの版が古い）は no-store のまま
    const v = u.searchParams.get('v'), cacheable = !!v && v === r.version;
    const headers = { 'Content-Type': r.type, 'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-store', ...(r.gzip ? { 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' } : {}) };
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : r.body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log('listening', port));
