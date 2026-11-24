// 共有用の画像（OGP、1200×630）を作る（2026-11-24）。
// 使い方（app/ で実行）：node tools/og-image/make-og-image.mjs [案 a|b|c|d（既定 d）] [出力 png（既定 static/og-image.png）]
// - 採用は案d（暗い背景・明るい色、凡例なし。2026-11-24 決定）。a〜c は比較用に残す。
// - 配信データ（画面の基幹系統の地図と同じ線データ）の送電線だけを描く。背景地図・潮流は使わない。
// - 線は OSM 由来（一部は国土地理院ベクトルタイル）なので、画像の中に出典を入れる。
// - 端末の Chrome（ヘッドレス）で HTML を撮る。外部への通信はしない（HTML は手元のファイルだけ）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const [variant = 'd', out = 'static/og-image.png'] = process.argv.slice(2);
const ROOT = process.cwd(); // app/ で実行する
// Chrome の場所：環境変数 CHROME か、Windows の標準のインストール先（ProgramFiles・ProgramFiles(x86) から組み立てる。手元の絶対パスを書かない）
const CHROME = [process.env.CHROME, ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))]
  .find(p => p && fs.existsSync(p));
if (!CHROME) throw Error('Chrome がない（環境変数 CHROME で場所を指定できる）');

// 描く線は画面の基幹系統の地図と同じデータ（catalog.json の purpose:geometry・feature:trunk-map。直流幹線の tohoku-dc-osm.json を含む）
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/catalog.json'), 'utf8'));
const files = catalog.datasets.filter(d => d.purpose === 'geometry' && d.feature === 'trunk-map').map(d => d.url.replace(/^\.\/data\//, ''));
// 建設中・計画中・廃止の線は描かない（今ある系統と誤解させないため）
const HIDE = new Set(['建設中', '計画中', '廃止']);
const lines = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', f), 'utf8')).lines)
  .filter(l => !HIDE.has(l.status ?? ''));

// 地図の範囲（沖縄を除く）と投影（経度は緯度36度で縮める簡易な正距円筒）
const box = {w: 128.6, e: 146.0, s: 30.9, n: 45.6}, k = Math.cos(36 * Math.PI / 180);
const W = 1200, H = 630;
const area = variant !== 'b' ? {x: 560, y: 20, w: 620, h: 590} : {x: 330, y: 15, w: 860, h: 600};
const sx = area.w / ((box.e - box.w) * k), sy = area.h / (box.n - box.s), s = Math.min(sx, sy);
const ox = area.x + (area.w - (box.e - box.w) * k * s) / 2, oy = area.y + (area.h - (box.n - box.s) * s) / 2;
const xy = ([lat, lon]) => [(ox + (lon - box.w) * k * s).toFixed(1), (oy + (box.n - lat) * s).toFixed(1)];

// 直流は画面と同じ色（src/display-settings.ts）
const dark = variant === 'd', color = ['c', 'd'].includes(variant);
// c・d は画面の電圧の色（src/display-settings.ts）。d は暗い背景に合わせて明るくする
const APP = dark ? {500: '#5aa2ff', 275: '#2fd3b4', 220: '#e0a35a', 187: '#9aa6ff', dc: '#f06ae0'} : {500: '#1558ac', 275: '#00816f', 220: '#976223', 187: '#5364ae', dc: '#b02fa5'};
const byKv = (kv, type) => color
  ? {c: type === 'dc' ? APP.dc : kv >= 500 ? APP[500] : kv >= 275 ? APP[275] : kv >= 220 ? APP[220] : APP[187], w: type === 'dc' ? 2.6 : kv >= 500 ? 3.4 : 2}
  : type === 'dc' ? {c: '#b02fa5', w: 2.6} : kv >= 500 ? {c: '#0f6e56', w: 3.2} : {c: '#3f9b7f', w: 1.8};
const paths = lines.flatMap(l => (l.paths ?? []).map(p => ({d: 'M' + p.map(q => xy(q).join(' ')).join('L'), ...byKv(l.voltageKV, l.currentType)})))
  .sort((a, b) => a.w - b.w)
  .map(p => `<path d="${p.d}" stroke="${p.c}" stroke-width="${p.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');

const BOLT = '<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M13.5 2 4.5 13.6h6.1L9.4 22l10.1-12.6h-6.2z"/></svg>'; // 画面の題名のマーク（src/real.ts）と同じ形
const credit = '参考表示（推測を含む）　送電線：© OpenStreetMap contributors（ODbL）・国土地理院 ベクトルタイル（試験公開）を加工';
const text = variant !== 'b'
  ? `<div class="mark">${BOLT}</div><h1>でんきの道</h1><p class="sub">全国の送電線と<br>電気の流れ</p><p class="lead">基幹送電線・変電所・発電所と、<br>OCCTO の公表実績による潮流を地図で</p>`
  : `<div class="mark">${BOLT}</div><h1>でんきの道</h1><p class="sub">全国の送電線と<br>電気の流れ</p>`;
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{background:${dark ? 'radial-gradient(circle at 75% 45%,#173a4a 0,#0b1d26 70%)' : color ? 'linear-gradient(120deg,#ffffff 0,#eaf3f8 55%,#e3f1ec 100%)' : '#f3f6f4'};font-family:"Yu Gothic UI","Meiryo",sans-serif;color:${dark ? '#f2f7f5' : '#123d34'};position:relative}
body>svg{position:absolute;left:0;top:0}
.t{position:absolute;left:64px;top:${variant !== 'b' ? 120 : 150}px;width:${variant !== 'b' ? 480 : 300}px}
.mark{width:64px;height:64px;border-radius:14px;background:${dark ? '#1d7f63' : '#123d34'};color:#fff;font-size:40px;display:flex;align-items:center;justify-content:center}
h1{font-size:${variant !== 'b' ? 76 : 64}px;margin:24px 0 8px;letter-spacing:.02em}
.sub{font-size:${variant !== 'b' ? 40 : 34}px;font-weight:700;margin:0;line-height:1.3}
.lead{font-size:24px;margin:28px 0 0;line-height:1.6;color:${dark ? '#c8d6d2' : '#3d4a4f'}}
.credit{position:absolute;right:16px;bottom:10px;font-size:15px;color:${dark ? '#9fb3ad' : '#5b666b'};background:${dark ? 'rgba(11,29,38,.7)' : 'rgba(255,255,255,.8)'};padding:2px 6px}
</style><svg width="${W}" height="${H}">${paths}</svg><div class="t">${text}</div><div class="credit">${credit}</div>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const page = path.join(dir, 'og.html');
try {
  fs.writeFileSync(page, html);
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
    `--user-data-dir=${path.join(dir, 'profile')}`, `--window-size=${W},${H}`, `--screenshot=${path.resolve(out)}`, pathToFileURL(page).href], {stdio: 'pipe', timeout: 60000});
  if (!fs.existsSync(path.resolve(out))) throw Error('撮影に失敗：' + (r.error ?? r.stderr));
} finally {
  fs.rmSync(dir, {recursive: true, force: true}); // 失敗しても一時フォルダー（Chrome のプロファイル）を残さない
}
console.log('書き出し：', out, fs.statSync(out).size, 'バイト', '線', lines.length);
