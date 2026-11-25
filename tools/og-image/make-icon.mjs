// サイトのアイコン（案A：山並みと送電線、2026-11-25 決定）を作る。
// 使い方（app/ で実行）：node tools/og-image/make-icon.mjs [出力フォルダー（既定 static）] [--ico]
// - icon.svg（手書きの SVG。メタデータなし）、icon-48.png・icon-192.png（端末の Chrome（ヘッドレス）で撮る。角は透明）を書き出す。
// - --ico を付けると favicon.ico（48px の PNG を1枚入れた ICO）も書き出す。ICO は一つ上のページ（yamanami-works.github.io）専用で、でんきの道には出さない（公開前チェックの許可外）。
// - 外部への通信はしない（HTML は手元のファイルだけ）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
const ico = args.includes('--ico');
const outDir = args.find(a => !a.startsWith('--')) ?? 'static';
const CHROME = [process.env.CHROME, ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map(d => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))]
  .find(p => p && fs.existsSync(p));
if (!CHROME) throw Error('Chrome がない（環境変数 CHROME で場所を指定できる）');

// 48×48 の座標で描く。濃い緑の丸・明るい緑の山並み・黄の送電線（共有用の画像（案d）の色に合わせた）
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
  + '<circle cx="24" cy="24" r="24" fill="#123d34"/>'
  + '<path d="M4 36 L16 20 L22 27 L31 14 L44 36 Z" fill="#2fd3b4"/>'
  + '<path d="M5 17 Q24 9 43 17" stroke="#ffd166" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  + '</svg>\n';

fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'icon.svg'), SVG);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-'));
try {
  for (const size of [48, 192]) {
    const page = path.join(dir, `icon-${size}.html`), out = path.resolve(outDir, `icon-${size}.png`);
    fs.rmSync(out, {force: true});
    // 小さい窓は Chrome が受け付けないことがあるので、192px で描いて倍率で大きさを合わせる（48px なら 0.25 倍で撮る）
    fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:192px;height:192px;overflow:hidden;background:transparent}svg{display:block;width:192px;height:192px}</style>${SVG}`);
    const scale = size / 192;
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--force-device-scale-factor=${scale}`,
      '--default-background-color=00000000', `--user-data-dir=${path.join(dir, 'profile')}`, '--window-size=192,192', `--screenshot=${out}`, pathToFileURL(page).href], {stdio: 'pipe', timeout: 60000});
    if (!fs.existsSync(out)) throw Error('撮影に失敗：' + (r.error ?? r.stderr));
    const b = fs.readFileSync(out);
    if (b.readUInt32BE(16) !== size || b.readUInt32BE(20) !== size) throw Error(`大きさが ${size} でない：${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`);
  }
} finally {
  fs.rmSync(dir, {recursive: true, force: true}); // 一時フォルダー（Chrome のプロファイル）を残さない
}

if (ico) {
  // ICO：見出し6バイト＋項目16バイト（48×48、32bit）のあとに PNG をそのまま入れる
  const png = fs.readFileSync(path.join(outDir, 'icon-48.png'));
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head.writeUInt8(48, 6); head.writeUInt8(48, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(outDir, 'favicon.ico'), Buffer.concat([head, png]));
}
console.log('書き出し：', outDir, fs.readdirSync(outDir).filter(f => /^(icon|favicon)/.test(f)).join(' '));
