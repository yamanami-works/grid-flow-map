import {createHash} from 'node:crypto';
import {sendBody, isDayFile} from './compact-response.mjs';
import {readFile, realpath, writeFile, stat, unlink} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {execFile} from 'node:child_process';
let launching=false,launchStartedAt;
// 2026-11-07：開発サーバーから起動した更新だけが失敗し、理由が分からなかったため、失敗時に子の終了理由と出力の末尾を手元のコンソールに出す（配信・状態ファイルには出さない）。
// 外部由来の文字が混ざり得るので、ANSI の色コード（ESC[…m など）を列ごと除き、さらに \n と \t 以外の制御文字（\r・ESC を含む）を除いてから出す。
const clean=s=>String(s??'').replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
function logRefreshFailure(label,error,stdout,stderr){
  console.error(`${label} refresh failed; retained last published data.`);
  console.error(`  code=${error?.code??''} signal=${error?.signal??''} killed=${error?.killed??''} message=${clean(String(error?.message??'').split('\n')[0]).slice(0,200)}`);
  const out=clean(stderr).trim()||clean(stdout).trim();
  if(out)console.error('  '+out.slice(-600).replace(/\n/g,'\n  '));
}

export async function readUpdateStatus(root=process.cwd()) {
  let status={state:'unknown',lastSuccessAt:null};
  try {const saved=JSON.parse(await readFile(resolve(root,'tmp/occto-status.json'),'utf8'));status={state:saved.state,lastAttemptAt:saved.lastAttemptAt,lastSuccessAt:saved.lastSuccessAt,publishedAt:saved.publishedAt};}
  catch {}
  return launching?{...status,state:'checking',lastAttemptAt:launchStartedAt}:status;
}
export async function ensureOcctoRefresh(root=process.cwd()) {
  if(launching)return;
  const status=await readUpdateStatus(root);
  if(Date.now()-Date.parse(status.lastAttemptAt??'')<5*60*1000)return;
  launching=true;launchStartedAt=new Date().toISOString();
  execFile(process.execPath,[resolve(root,'scripts/update-occto.mjs')],{cwd:root,windowsHide:true,timeout:2*60*60*1000},(error,stdout,stderr)=>{
    launching=false;
    if(error)logRefreshFailure('OCCTO',error,stdout,stderr);
  });
}

// 東北以外の8地域と連系線（2026-10-03 配布範囲の変更で /validation/ から移動）：潮流を読まれたとき、前回の確認開始から5分以上なら
// scripts/update-<地域>.mjs を裏で1回走らせる（東北の update-occto と同じ扱い）。状態は tmp/<地域>-status.json を /data/<地域>-status.json で公開する。
export const REGION_FLOWS={hokkaido:'update-hokkaido',tokyo:'update-tokyo',chubu:'update-chubu',hokuriku:'update-hokuriku',kansai:'update-kansai',chugoku:'update-chugoku',shikoku:'update-shikoku',kyushu:'update-kyushu',tie:'update-ties'};
const running=new Map();
export async function readRegionStatus(root,key){
  let status={state:'unknown'};
  try{const saved=JSON.parse(await readFile(resolve(root,`tmp/${key}-status.json`),'utf8'));status={state:saved.state,lastAttemptAt:saved.lastAttemptAt,lastSuccessAt:saved.lastSuccessAt,publishedAt:saved.publishedAt};}catch{}
  return running.has(key)?{...status,state:'checking',lastAttemptAt:running.get(key)}:status;
}
// 2026-10-09：開発サーバーと携帯用プレビューを同時に動かすと、両方が同じ更新を同時に走らせて OCCTO の取得が失敗していた（連系線）。
// プロセスをまたいで1本だけ走るよう tmp/<地域>-refresh.lock を排他作成する（20分より古いロックは途中終了の残りとみなして取り直す）。
async function takeLock(root,key){
  const file=resolve(root,`tmp/${key}-refresh.lock`);
  try{await writeFile(file,String(process.pid),{flag:'wx'});return file;}
  catch{try{if(Date.now()-(await stat(file)).mtimeMs<20*60*1000)return null;await writeFile(file,String(process.pid));return file;}catch{return null;}}
}
export async function ensureRegionRefresh(root,key){
  if(running.has(key)||!REGION_FLOWS[key])return;
  const status=await readRegionStatus(root,key);
  if(Date.now()-Date.parse(status.lastAttemptAt??'')<5*60*1000)return;
  running.set(key,new Date().toISOString());
  const lock=await takeLock(root,key);if(!lock){running.delete(key);return;}
  execFile(process.execPath,[resolve(root,`scripts/${REGION_FLOWS[key]}.mjs`)],{cwd:root,windowsHide:true,timeout:15*60*1000},(error,stdout,stderr)=>{
    running.delete(key);void unlink(lock).catch(()=>{});
    if(error)logRefreshFailure(key,error,stdout,stderr);
  });
}

// 2026-11-24：開発サーバー（vite dev・preview）用。Vite の Host の照合は、プラグインが use した middleware より後に動くので効かない。
// Host のホスト名が localhost・127.0.0.1・::1・*.localhost のときだけ通し、ほかは 403（LAN の IP からの確認も 403。DNS リバインディングで data/private の表を読まれないように）。
// 携帯用プレビュー（preview-server.mjs）はトンネルの Host で動き認証の後ろにあるので、これを使わない。
export function localHostOnly(middleware) {
 return (req,res,next)=>{
  const host=typeof req.headers.host==='string'?req.headers.host.toLowerCase():'';
  const name=host.startsWith('[')?(host.match(/^\[([^\]]*)\](?::\d+)?$/)?.[1]??''):host.replace(/:\d+$/,'');
  if(name==='localhost'||name==='127.0.0.1'||name==='::1'||/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.localhost$/.test(name))return middleware(req,res,next);
  res.statusCode=403;res.setHeader('Cache-Control','no-store');res.end();
 };
}

// Mounted without a Connect path prefix: req.url always contains /data/.
// Both Vite modes and the authenticated preview use the same canonical files.
export function liveDataMiddleware(root=process.cwd(),refresh=()=>ensureOcctoRefresh(root),refreshRegions=true) {
 return async(req,res,next=()=>{})=>{
  let pathname;
  try { pathname=decodeURIComponent((req.url??'').split('?')[0]); }
  catch {res.statusCode=400;res.end();return;}
  if(/(?:^|\/)(?:tmp|backups)(?:\/|$)|\/public\/data\//.test(pathname)){res.statusCode=404;res.end();return;}
  if(!pathname.startsWith('/data/')){next();return;}
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
  try {
   const base=await realpath(resolve(root,'public'));
   const manifest=JSON.parse(await readFile(resolve(base,'data/catalog.json'),'utf8'));
   const allowed=new Set(['/data/catalog.json','/data/connection-gaps.json','/data/LICENSE.txt']);
   for(const d of manifest.datasets){
    if(d.access==='public'&&/^\.\/data\/[a-z0-9/-]+\.json$/.test(d.url)&&!d.url.includes('..'))allowed.add('/'+d.url.slice(2));
   }
   let body;
   const regionStatus=pathname.match(/^\/data\/([a-z]+)-status\.json$/);
   // 2026-10-05：画面は5分ごとに状態ファイルだけを見るので、状態の読み出しでも更新を始める（以前は潮流データの読み出しでだけ始めていた）
   if(pathname==='/data/occto-status.json'){void refresh().catch(()=>{});body=JSON.stringify(await readUpdateStatus(root));}
   else if(regionStatus&&REGION_FLOWS[regionStatus[1]]){if(refreshRegions)void ensureRegionRefresh(root,regionStatus[1]).catch(()=>{});body=JSON.stringify(await readRegionStatus(root,regionStatus[1]));}
   else {
    // 潮流の1日分のファイル（scripts/flow-split.mjs、2026-10-10）：カタログにある <名前>-latest.json の <名前>-days/<日付>.json だけ
    const dayFile=pathname.match(/^\/data\/([a-z-]+)-days\/\d{4}-\d{2}-\d{2}\.json$/);
    if(!allowed.has(pathname)&&!(dayFile&&allowed.has('/data/'+dayFile[1]+'-latest.json'))){res.statusCode=404;res.end();return;}
    // 携帯用だけのデータは data/private/ から返す（開発サーバーと携帯用プレビュー。読み取り専用の配信 tools/serve-readonly.mjs は返さない）（2026-10-11 オーナー承認：各社の表は許諾を確認するまで public/ の外の data/private/ に置き、build:private のときだけ携帯用ビルドへコピーする。docs/RULES.md 5節）
    const priv=manifest.datasets.find(d=>d.distribution==='private-preview'&&'/'+d.url.slice(2)===pathname);
    const fileBase=priv?await realpath(resolve(root,'data/private')).catch(()=>null):base;if(!fileBase){res.statusCode=404;res.end();return;}
    const file=await realpath(resolve(fileBase,priv?'.'+pathname.slice('/data'.length):'.'+pathname));
    if(!file.startsWith(fileBase+sep)){res.statusCode=404;res.end();return;}
    if(/^\/data\/occto-tohoku(?:-latest)?\.json$/.test(pathname))void refresh().catch(()=>{});
    const regionFlow=pathname.match(/^\/data\/([a-z]+)-flow(?:-latest)?\.json$/);
    if(regionFlow&&REGION_FLOWS[regionFlow[1]]&&refreshRegions)void ensureRegionRefresh(root,regionFlow[1]).catch(()=>{});
    body=await readFile(file);
    // ?v= がファイルの中身のハッシュ（先頭12桁、カタログの版と同じ作り方）と同じなら中身は変わらないのでキャッシュさせる（2026-10-10 表示速度の改善）。
    // カタログではなくファイルと比べる：ビルドせずにデータだけ作り直した時（カタログの版が古い）はキャッシュさせず、毎回新しい中身を返す。潮流・状態には版が付かない
    const v=new URLSearchParams((req.url??'').split('?')[1]??'').get('v');
    if(v&&v===createHash('sha256').update(body).digest('hex').slice(0,12))res.setHeader('Cache-Control','private, max-age=31536000, immutable');
   }
   sendBody(req,res,200,{'Content-Type':pathname.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8'},body,{compact:pathname.endsWith('.json')&&!isDayFile(pathname)});
  } catch {res.statusCode=503;res.end('Data unavailable');}
 };
}
