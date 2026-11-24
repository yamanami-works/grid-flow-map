// Smaller map-data responses without touching the files on disk (approvals and tests check the stored bytes).
// - JSON map data: whitespace removed, fractional numbers rounded to 6 decimals (~0.1 m). Equal coordinates stay equal.
// - Text/JSON/JS/CSS over 1 KB: gzip when the client accepts it.
// Byte-verified responses (the Miyagi pilot checks a SHA-256 in the browser) must be sent with compact:false.
// 潮流の日別ファイル（/data/<名前>-days/<日付>.json）も画面がハッシュを照合するので縮めない（2026-11-24、isDayFile）。
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

export const isDayFile = p => /^\/data\/[a-z]+(?:-[a-z]+)*-days\/\d{4}-\d{2}-\d{2}\.json$/.test(p);
const COMPRESSIBLE =/^(text\/|application\/(json|javascript)|image\/svg)/;
const cache = new Map();
const remember = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); if (cache.size > 64) cache.delete(cache.keys().next().value); } return v; };
const round6 = (_k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v;

export function compactJson(body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return remember('j' + createHash('sha1').update(buf).digest('hex'), () => Buffer.from(JSON.stringify(JSON.parse(buf.toString('utf8')), round6)));
}

/** Writes status, headers and body; compacts JSON when asked and gzips when the client accepts it. */
export function sendBody(req, res, status, headers, body, {compact = false} = {}) {
  let out = body == null ? body : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const type = String(headers['Content-Type'] ?? res.getHeader('Content-Type') ?? '');
  if (out && compact && /json/.test(type)) out = compactJson(out);
  if (out && out.length > 1024 && COMPRESSIBLE.test(type) && /\bgzip\b/.test(req?.headers?.['accept-encoding'] ?? '')) {
    const src = out; out = remember('z' + createHash('sha1').update(src).digest('hex'), () => gzipSync(src, {level: 6}));
    headers = {...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding'};
  }
  res.writeHead(status, headers); res.end(req?.method === 'HEAD' ? undefined : out);
}
