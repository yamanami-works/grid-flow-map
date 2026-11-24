// 表示速度の計測（2026-10-10 オーナー指示「ブラウザ表示が遅い。まず計測し…」）。
// このPCの Chrome を画面なしで起動し、DevTools と同じ仕組み（Chrome DevTools Protocol）で次を測る：
//   起動：ページ読み込み開始から grid:map-ready（地図を描き終えた）・grid:ready（潮流まで描き終えた起動完了）までの時間、
//         その間のメインスレッドの処理時間（Performance.getMetrics の TaskDuration・ScriptDuration）、読み込んだデータの件数・量
//   操作：時刻スライダー1回・線選択1回の処理時間（イベント処理の同期部分と、次の描画まで）。各7回の中央値
// 使い方：node tools/perf-measure.mjs <ラベル> [URL] [起動の回数]（既定 http://127.0.0.1:8766/ ・3回。サーバーは .claude/launch.json の app-readonly（tools/serve-readonly.mjs））
// 結果：reports/perf/perf-<ラベル>.json（app の外、powerflow-site/reports）
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const label = process.argv[2] ?? 'run', url = process.argv[3] ?? 'http://127.0.0.1:8766/', runs = Number(process.argv[4] ?? 3);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!CHROME) throw Error('Chrome が見つからない');
const port = 9333, profile = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-perf-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,800', '--no-first-run', '--no-default-browser-check', 'about:blank'], {stdio: 'ignore'});
// 途中で失敗しても Chrome と一時プロファイルを残さない（2026-10-25。--check が止まった後に Chrome が残っていた）
process.on('exit', () => { chrome.kill(); try { fs.rmSync(profile, {recursive: true, force: true, maxRetries: 20, retryDelay: 100}); } catch {} });
process.on('SIGINT', () => process.exit(130)); // Ctrl+C でも上の後片付けを通す
// プロファイルの関数名を、ビルドの sourcemap（vite build --sourcemap のとき dist/assets/*.map）で元のファイル・行に直す
const maps = new Map();
const where = async cf => { const file = cf.url.split('/').pop(); if (!/.js$/.test(file)) return ''; let m = maps.get(file);
  if (m === undefined) { try { const {SourceMapConsumer} = await import('source-map-js'); m = new SourceMapConsumer(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../dist/assets', file + '.map'), 'utf8'))); } catch { m = null; } maps.set(file, m); }
  if (!m) return ''; const o = m.originalPositionFor({line: cf.lineNumber + 1, column: cf.columnNumber}); return o.source ? ' ' + o.source.split('/').pop() + ':' + o.line : ''; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target; for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
if (!target) throw Error('Chrome に接続できない');
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', () => j(Error('Chrome との接続に失敗'))); ws.addEventListener('close', () => j(Error('Chrome との接続が閉じた'))); });
let seq = 0; const pending = new Map(), listeners = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const {res, rej} = pending.get(m.id); m.error ? rej(Error(m.error.message)) : res(m.result); } else listeners.forEach(f => f(m)); });
// Chrome が落ちる・接続が閉じる・応答が来ないときに待ち続けない（2026-10-30。提案D の変更レビュー 提案2）
const failAll = msg => { for (const {rej} of [...pending.values()]) rej(Error(msg)); };
ws.addEventListener('close', () => failAll('Chrome との接続が閉じた')); ws.addEventListener('error', () => failAll('Chrome との接続の誤り'));
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq, limit = (params.timeout ?? 120000) + 30000;
  const timer = setTimeout(() => entry.rej(Error(`${method} の応答が ${limit / 1000} 秒来ない`)), limit);
  const done = f => v => { clearTimeout(timer); pending.delete(id); f(v); }, entry = {res: done(res), rej: done(rej)};
  if (ws.readyState !== WebSocket.OPEN) return entry.rej(Error('Chrome との接続が開いていない'));
  pending.set(id, entry); ws.send(JSON.stringify({id, method, params})); });
const evaluate = async (expression, timeout = 120000) => { const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true, timeout}); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
await send('Page.enable'); await send('Performance.enable'); await send('Network.enable');
// --mobile：スマホ相当（幅390px・モバイル表示・タッチ、CPU 4倍スロットリング。2026-10-10 オーナー指示）
const MOBILE = process.argv.includes('--mobile');
if (MOBILE) { await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 3, mobile: true}); await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5}); await send('Emulation.setCPUThrottlingRate', {rate: 4}); }
else await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const med = a => { const s = [...a].sort((x, y) => x - y); return Math.round(s[s.length >> 1] * 10) / 10; };
async function boot(cold) {
  await send('Network.setCacheDisabled', {cacheDisabled: cold});
  await send('Page.navigate', {url: 'about:blank'}); await sleep(300);
  const before = await metrics();
  await send('Page.navigate', {url});
  const ready = await evaluate(`(async()=>{for(let i=0;i<240&&!performance.getEntriesByName('grid:ready').length;i++)await new Promise(r=>setTimeout(r,250));
    const m=n=>performance.getEntriesByName(n)[0]?.startTime??null;const res=performance.getEntriesByType('resource').filter(r=>/\\/data\\/|\\/validation\\//.test(r.name)&&r.startTime<(m('grid:ready')??1e9));
    return {mapReady:m('grid:map-ready'),ready:m('grid:ready'),fetches:res.length,kb:res.reduce((s,r)=>s+r.encodedBodySize,0)/1024,transferKB:res.reduce((s,r)=>s+r.transferSize,0)/1024};})()`);
  const after = await metrics();
  return {...ready, taskMs: (after.TaskDuration - before.TaskDuration) * 1000, scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000, layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000};
}
// 任意の確認（--eval <ファイル>）：起動完了の後に、そのファイルの式（Promise 可）を評価して表示するだけ（計測はしない）
const evalAt = process.argv.indexOf('--eval');
if (evalAt > 0) { await send('Page.navigate', {url}); await evaluate("(async()=>{for(let i=0;i<240&&!performance.getEntriesByName('grid:ready').length;i++)await new Promise(r=>setTimeout(r,250));})()");
  console.log(JSON.stringify(await evaluate(fs.readFileSync(process.argv[evalAt + 1], 'utf8')), null, 1)); ws.close(); chrome.kill(); process.exit(0); }
// 起動の処理の内訳（--profile-boot）：キャッシュなしの起動1回のCPUプロファイルを関数ごとの自己時間で集計して表示するだけ
if (process.argv.includes('--profile-boot')) {
  await send('Profiler.enable'); await send('Profiler.setSamplingInterval', {interval: 500}); await send('Network.setCacheDisabled', {cacheDisabled: true});
  await send('Page.navigate', {url: 'about:blank'}); await sleep(300); await send('Profiler.start'); await send('Page.navigate', {url});
  await evaluate("(async()=>{for(let i=0;i<240&&!performance.getEntriesByName('grid:ready').length;i++)await new Promise(r=>setTimeout(r,250));})()");
  const {profile} = await send('Profiler.stop'); const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  // 自己時間と、real.ts の関数（呼び出し元をたどって最初に当たる名前付きの関数）ごとの合計
  const total = new Map();
  profile.samples.forEach((id, i) => { const ms = (profile.timeDeltas[i] ?? 0) / 1000, n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) ?? 0) + ms);
    const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const f = byId.get(x).callFrame; if (/real-/.test(f.url) && f.functionName) { const kk = f.functionName + ':' + f.lineNumber + ':' + f.columnNumber; if (!seen.has(kk)) { seen.add(kk); total.set(kk, (total.get(kk) ?? 0) + ms); } } } });
  console.log(JSON.stringify({self: [...self].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => k + ' ' + Math.round(v)), inclusive: [...total].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + ' ' + Math.round(v))}, null, 1));
  ws.close(); chrome.kill(); process.exit(0);
}
const result = {label, url, measuredAt: new Date().toISOString(), viewport: MOBILE ? '390x844 mobile, CPU 4x' : '1280x800', boots: []};
for (let i = 0; i < runs; i++) result.boots.push(await boot(true));
result.warmBoot = await boot(false); // キャッシュあり（2回目以降の訪問）
// 待機中（粒子のアニメーションだけ）のメインスレッド処理時間：起動完了の後、5秒間
{ await sleep(1500); const w = []; for (let i = 0; i < 3; i++) { const a = await metrics(); await sleep(5000); const z = await metrics(); w.push((z.TaskDuration - a.TaskDuration) * 1000); } result.idleWindows = w.map(Math.round); result.idleTaskMsPer5s = med(w); }
// 操作（起動完了の後、1.5秒おいて）
result.interactions = await evaluate(`(async()=>{await new Promise(r=>setTimeout(r,1500));
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));const S=document.querySelector('#actual-hour');const sl=[],sf=[];
  for(let i=0;i<7;i++){S.value=String(Number(S.value)+(i%2?1:-1));const t0=performance.now();S.dispatchEvent(new Event('input',{bubbles:true}));const t1=performance.now();await frame();sl.push(t1-t0);sf.push(performance.now()-t0);await new Promise(r=>setTimeout(r,300));}
  const ids=[...document.querySelectorAll('#real-results [data-record]')].map(b=>b.dataset.record);const pick=[3,9,15,21,27,33,39].map(i=>ids[i]).filter(Boolean);const ss=[],sfr=[];
  // 線選択は2つに分けて測る（2026-10-10）：クリック→詳細パネル表示（次の描画まで）と、クリック→拡大完了（grid:focus-done、目印のない版は地図の動きが止まるまで）
  const zoomDone=async t0=>{for(let i=0;i<300;i++){const m=performance.getEntriesByName('grid:focus-done').find(e=>e.startTime>=t0);if(m)return m.startTime;await new Promise(r=>requestAnimationFrame(r));}return null;};
  const settle=async()=>{const pane=document.querySelector('.leaflet-map-pane');let last='',same=0;for(let i=0;i<300&&same<4;i++){await new Promise(r=>requestAnimationFrame(r));const t=pane.style.transform+document.querySelector('.leaflet-container').className;if(t===last&&!/zoom-anim/.test(t))same++;else{same=0;last=t;}}return performance.now();};
  const zz=[];
  // 詳細パネルの表示＝クリックの後の最初の描画フレーム（requestAnimationFrame の時刻。この直後に画面に出る。拡大はその後のタスクで行う）
  for(const id of pick){const b=document.querySelector('#real-results [data-record="'+CSS.escape(id)+'"]');if(!b)continue;const t0=performance.now();b.click();const t1=performance.now();const tf=await new Promise(r=>requestAnimationFrame(()=>r(performance.now())));ss.push(t1-t0);sfr.push(tf-t0);
    const shown=!document.querySelector('#detail').hidden;let z=await Promise.race([zoomDone(t0),new Promise(r=>setTimeout(()=>r(null),3000))]);if(z==null)z=await settle()-4*16.7;zz.push(z-t0);if(!shown)sfr[sfr.length-1]=NaN;await new Promise(r=>setTimeout(r,500));}
  return {slider:{sync:sl,toFrame:sf},select:{sync:ss,toFrame:sfr,toZoomDone:zz,ids:pick}};})()`);
// 処理の内訳（--profile）：スライダー1回・線選択1回のCPUプロファイルを関数ごとの自己時間で集計
if (process.argv.includes('--profile')) {
  await send('Profiler.enable'); await send('Profiler.setSamplingInterval', {interval: 200});
  const prof = async expr => { await send('Profiler.start'); await evaluate(expr); const {profile} = await send('Profiler.stop'); const self = new Map(), dt = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
    for (const [i, id] of profile.samples.entries()) { const n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + (await where(n.callFrame) || ' ' + n.callFrame.url.split('/').pop()); self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000); }
    return [...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => k + ' ' + Math.round(v) + 'ms'); };
  result.profile = {
    slider: await prof("(async()=>{const S=document.querySelector('#actual-hour');S.value=String(Number(S.value)-1);S.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));})()"),
    select: await prof("(async()=>{const b=[...document.querySelectorAll('#real-results [data-record]')][12];b.click();await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));})()"),
  };
  console.log(JSON.stringify(result.profile, null, 1));
}
// 表示の一致の確認（--check）：時刻を変えた直後（部分的な描き直し）と、そのあと全体を描き直した後とで、凡例・一覧・件数・詳細の文字が同じか
// 全体の描き直しは、表示されていてチェックの入った設備マーカーの種類を2回切り替えて起こす（「要注意の線を表示」は 4981aeb で削除。2026-10-25）
if (process.argv.includes('--check')) {
  result.check = await evaluate(`(async()=>{const wait=()=>new Promise(r=>setTimeout(r,300));const snap=()=>({key:document.querySelector('#map-flow-key')?.innerText,list:document.querySelector('#real-results')?.innerText,count:document.querySelector('#real-count')?.innerText,summary:document.querySelector('#dataset-summary')?.innerText,time:document.querySelector('#actual-time-label')?.innerText,detail:document.querySelector('#detail')?.hidden?'':document.querySelector('#detail')?.innerText});
    const S=document.querySelector('#actual-hour');const out=[];
    for(const v of ['10','3','20']){S.value=v;S.dispatchEvent(new Event('input',{bubbles:true}));await wait();const a=snap();
      const c=[...document.querySelectorAll('[data-kind]')].find(x=>x.checked&&!x.closest('label')?.hidden);if(!c)throw Error('全体を描き直す切り替え（設備マーカー）がない');c.click();await wait();c.click();await wait();const b=snap();
      out.push({v,same:Object.keys(a).filter(k=>a[k]!==b[k]).length===0,diff:Object.keys(a).filter(k=>a[k]!==b[k])});}
    const ids=[...document.querySelectorAll('#real-results [data-record]')].map(x=>x.dataset.record);const id=ids[12];
    document.querySelector('#real-results [data-record="'+CSS.escape(id)+'"]').click();await wait();S.value='8';S.dispatchEvent(new Event('input',{bubbles:true}));await wait();const d1=snap().detail;
    return {slider:out,detailAfterTimeChange:d1?.slice(0,200)};})()`);
  console.log(JSON.stringify(result.check));
}
const b = result.boots;
result.summary = {
  mapReadyMs: med(b.map(x => x.mapReady)), readyMs: med(b.map(x => x.ready)), bootTaskMs: med(b.map(x => x.taskMs)), bootScriptMs: med(b.map(x => x.scriptMs)),
  fetches: b[0].fetches, dataKB: Math.round(b[0].kb), warmReadyMs: Math.round(result.warmBoot.ready), warmTransferKB: Math.round(result.warmBoot.transferKB),
  idleTaskMsPer5s: result.idleTaskMsPer5s,
  sliderSyncMs: med(result.interactions.slider.sync), sliderToFrameMs: med(result.interactions.slider.toFrame),
  selectSyncMs: med(result.interactions.select.sync), selectToDetailMs: med(result.interactions.select.toFrame), selectToZoomDoneMs: med(result.interactions.select.toZoomDone),
};
const out = path.resolve(import.meta.dirname, '../../reports/perf'); fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, `perf-${label}.json`), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result.summary));
ws.close(); chrome.kill(); await sleep(500); try { fs.rmSync(profile, {recursive: true, force: true}); } catch {}
