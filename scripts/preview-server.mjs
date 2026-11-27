import {sendBody, isDayFile} from './compact-response.mjs';
import {validatePilot} from './pilot-validation.mjs';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import {isProtectedPath,authorizeProtectedRequest} from './publication-policy.mjs';
import {liveDataMiddleware} from './live-data.mjs';

export async function createPreviewServer({root:directory,username='grid',password,expires,loginLimit=30,liveRoot,miyagiValidationFile,hokkaidoValidation=false,tokyoValidation=false,chubuValidation=false,hokurikuValidation=false,kansaiValidation=false,chugokuValidation=false,shikokuValidation=false,kyushuValidation=false}) {
// Explicit operator opt-in; login is not a purchased entitlement. No directory route.
const miyagiValidation=miyagiValidationFile?await readFile(miyagiValidationFile):null;
if(miyagiValidation)validatePilot(JSON.parse(miyagiValidation),createHash('sha256').update(miyagiValidation).digest('hex'));
const liveData=liveRoot?liveDataMiddleware(liveRoot):null;
const root=await realpath(directory);
const catalog=JSON.parse(await readFile(resolve(root,'data/catalog.json'),'utf8'));
const allowed=new Set(['/index.html','/data/catalog.json','/data/connection-gaps.json','/data/LICENSE.txt']);
for(const d of catalog.datasets){if(d.access!=='public'||!/^\.\/data\/[a-z0-9/-]+\.json$/.test(d.url)||d.url.includes('..'))throw Error('Unsafe catalog');allowed.add('/'+d.url.slice(2));}
// Built assets get new hashed names on every rebuild: rescan the folder when an unknown asset is requested (same name rule).
const scanAssets=async()=>{for(const file of await readdir(resolve(root,'assets')))if(/^[a-zA-Z0-9_-]+\.(?:js|css|png|svg|woff2)$/.test(file))allowed.add('/assets/'+file);};
await scanAssets();
// ログインの失敗回数は接続元ごとに数える（2026-11-24。全員で1つだと、URL を知った人が失敗を重ねて本人を締め出せた）。
// 接続元は cf-connecting-ip、なければ接続のアドレス。このヘッダーを採る根拠：待ち受けは 127.0.0.1 だけで、外からの要求は cloudflared のトンネル経由だけ。
// Cloudflare は入口でこの値を付け直すので、外の利用者は偽れない。偽れるのは手元のプロセスだけで、それは信頼の範囲内（手元のファイルを直接読める）。
// 数えるのは失敗だけ。1分ごとに数え直す。
// 全体の失敗の上限は置かない（2026-11-24）：多くの接続元から失敗を重ねると、関係のない本人までログインできなくなるため。パスワードは 144ビットの乱数で、総当たりの速さの上限は要らない。
// 同じ接続元の並列の POST /login が判定をまとめて通らないよう、処理中の件数も上限に含める（失敗の表とは別に持ち、数え直しで消さない）。
let failures=new Map(),windowStart=Date.now();
const inflight=new Map();
const sourceOf=req=>{const cf=req.headers['cf-connecting-ip'];return typeof cf==='string'&&cf.length<=64?cf:String(req.socket.remoteAddress);};
const roll=()=>{if(Date.now()-windowStart>=60000){failures=new Map();windowStart=Date.now();}};
const limited=req=>{roll();const key=sourceOf(req);return (failures.get(key)??0)+(inflight.get(key)??0)>=loginLimit;};
const fail=req=>{roll();const key=sourceOf(req);if(!failures.has(key)&&failures.size>=1000)failures.delete(failures.keys().next().value);failures.set(key,(failures.get(key)??0)+1);};
const begin=key=>inflight.set(key,(inflight.get(key)??0)+1);
const done=key=>{const n=(inflight.get(key)??1)-1;if(n>0)inflight.set(key,n);else inflight.delete(key);};
const sessions = new Set();
const csrf = randomBytes(32).toString('hex');
const loginPage = (error = '') => `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GRID ログイン</title><style>body{font:16px system-ui;background:#eff5f2;color:#234c42;margin:0;padding:24px}main{max-width:360px;margin:8vh auto;background:white;padding:24px;border-radius:18px}label{display:block;margin:20px 0 8px}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;border:1px solid #bbcfc6;border-radius:8px}button{margin-top:24px;background:#245c4c;color:white}p{line-height:1.7}small{color:#62796c}.error{color:#a22626}</style><main><h1>GRID</h1><p>送電線マップ 一時プレビュー</p><p class="error">${error}</p><form method="post" action="/login"><input type="hidden" name="csrf" value="${csrf}"><label for="username">ユーザー名</label><input id="username" name="username" value="grid" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="password">パスワード</label><input id="password" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required><button>ログイン</button></form><p><small>このプレビュー専用のパスワードを入力してください。</small></p></main></html>`;
const digest = value => createHash('sha256').update(value).digest();
const expected = digest(`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.ico':'image/x-icon' };
const server = createServer(async (req,res) => {
  try {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cyberjapandata.gsi.go.jp; connect-src 'self'; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(self)'); // 現在地ボタンを携帯で確かめるため自サイトだけ許可（2026-11-26）
  const session = /(?:^|;\s*)grid_preview=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  // 有効なセッションがあれば回数制限を見ない（不正な Authorization が付いていても、ログイン済みの閲覧は止めない）。
  // セッションのない要求は、正しい Basic 認証でも、その接続元が上限に達していれば 429（接続元ごとなので、ほかの人は巻き込まれない）
  if(!sessions.has(session)&&(req.url==='/login'&&req.method==='POST'||req.headers.authorization)&&limited(req)){res.writeHead(429,{'Retry-After':'60'});res.end('Too many login attempts');return;}
  if(req.headers['sec-fetch-site']==='cross-site'&&req.method==='POST'){res.writeHead(403,{'Content-Type':'text/html; charset=utf-8'});res.end(loginPage('別サイトからのログイン送信はできません。このURLを直接開き直してください。'));return;}
  if (Date.now() >= expires) {res.writeHead(410);res.end('Preview expired');return;}
  if (req.url === '/login' && req.method === 'POST') {
   const source = sourceOf(req); begin(source); // 判定から begin までに await はない。応答のすべての出口（403・413・切断の例外を含む）で finally により減らす
   try {
    const origin = req.headers.origin;
    if (origin === 'null') {res.writeHead(403,{'Content-Type':'text/html; charset=utf-8'});res.end(loginPage('送信元を確認できません。URLをSafariで開き直してログインしてください。'));return;}
    if (origin) {
      let originHost; try { originHost = new URL(origin).host; } catch {res.writeHead(403);res.end();return;}
      if (originHost !== req.headers.host) {res.writeHead(403);res.end();return;}
    }
    let body = ''; for await (const chunk of req) {body += chunk; if(body.length>4096){res.writeHead(413);res.end();return;}}
    const form = new URLSearchParams(body);
    if (!timingSafeEqual(digest(form.get('csrf') || ''),digest(csrf))) {res.setHeader('Content-Type','text/html; charset=utf-8');res.writeHead(403);res.end(loginPage('画面を再読み込みしてからログインしてください。'));return;}
    if (form.get('username')?.trim() === username && timingSafeEqual(digest(form.get('password')?.trim() || ''),digest(password))) {
      const token = randomBytes(32).toString('hex');if(sessions.size>=100)sessions.delete(sessions.values().next().value);sessions.add(token);
      res.setHeader('Set-Cookie',`grid_preview=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor((expires-Date.now())/1000)}`);
      // A typed completion page avoids empty redirect downloads in embedded mobile browsers.
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン完了</title><p>ログインしました。<a href="/">送電線マップを開く</a></p></html>');return;
    }
    fail(req);res.setHeader('Content-Type','text/html; charset=utf-8');res.writeHead(401);res.end(loginPage('ユーザー名またはパスワードを確認してください。'));return;
   } finally { done(source); }
  }
  if (!sessions.has(session) && !timingSafeEqual(digest(req.headers.authorization || ''),expected)) {
    if (req.headers.authorization) fail(req); // Basic 認証の不一致だけを失敗として数える（ヘッダーなしの 401 は数えない）
    if (req.url === '/' || req.url === '/login') {res.setHeader('Content-Type','text/html; charset=utf-8');res.writeHead(200);res.end(loginPage());return;}
    res.writeHead(401);res.end('Authentication required');return;
  }
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/validation/miyagi-ishinomaki.json'&&miyagiValidation){sendBody(req,res,200,{'Content-Type':'application/json; charset=utf-8'},miyagiValidation);return;}
    if(liveData&&pathname.startsWith('/data/')){await liveData(req,res);return;}
    if(isProtectedPath(pathname)&&!authorizeProtectedRequest()){res.writeHead(403);res.end('Entitlement verification not configured');return;}
    const requested=pathname==='/'?'/index.html':pathname;
    if(!allowed.has(requested)&&requested.startsWith('/assets/'))await scanAssets();
    if(!allowed.has(requested)){res.writeHead(404);res.end('Not found');return;}
    const file=await realpath(resolve(root,'.'+requested));
    if(!file.startsWith(root+sep)){res.writeHead(404);res.end();return;}
    const data = await readFile(file);
    sendBody(req,res,200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'},data,{compact:requested.startsWith('/data/')&&!isDayFile(requested)});
  } catch {res.writeHead(404);res.end('Not found');}
  } catch { if (!res.headersSent) res.writeHead(400); res.end('Invalid request'); }
});
server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
server.loginInflight=()=>inflight.size; // テスト用：処理中の POST /login が残っていないことを確かめる
return server;
}
