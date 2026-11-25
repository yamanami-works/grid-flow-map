// 検索・共有向けの head の情報（2026-11-24）：canonical・OGP が公開サイトの URL と題名・説明にそろい、外部の読み込みや noindex がないこと。
// URL の正本は .github/workflows/publish.yml の SITE_URL。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const yml = readFileSync('.github/workflows/publish.yml', 'utf8');
const src = readFileSync('index.html', 'utf8');
const siteUrls = [...yml.matchAll(/\n\s+SITE_URL: (\S+)\r?\n/g)].map(m => m[1]);
const attr = (html, re) => { const all = [...html.matchAll(re)].map(m => m[1]); assert.equal(all.length, 1, String(re)); return all[0]; };
const canonical = html => attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g);
const og = (html, p) => attr(html, new RegExp(`<meta\\s+property="og:${p}"\\s+content="([^"]*)"`, 'g'));
const title = html => attr(html, /<title>([^<]*)<\/title>/g);
const description = html => attr(html, /<meta\s+name="description"\s+content="([^"]*)"/g);
// Search Console の所有確認（HTML タグ方式）。公開ページに置く前提の値。消すと確認が外れる
const verification = html => attr(html, /<meta\s+name="google-site-verification"\s+content="([^"]*)"/g);

function checkHead(html) {
  assert.equal(siteUrls.length, 1, 'publish.yml の SITE_URL は1つ');
  assert.equal(canonical(html), siteUrls[0]);
  assert.equal(og(html, 'url'), siteUrls[0]);
  assert.equal(og(html, 'title'), title(html));
  assert.equal(og(html, 'description'), description(html));
  assert.equal(og(html, 'type'), 'website');
  assert.equal(attr(html, /<meta\s+name="twitter:card"\s+content="([^"]*)"/g), 'summary_large_image');
  assert.equal(og(html, 'image'), siteUrls[0] + 'assets/og-image.png');
  assert.equal(og(html, 'image:width'), '1200');
  assert.equal(og(html, 'image:height'), '630');
  assert.ok(og(html, 'image:alt').length > 0);
  assert.match(verification(html), /^[A-Za-z0-9_-]{20,}$/, '所有確認の値の形式');
  assert.doesNotMatch(html, /noindex|nofollow/i);
  // link は属性の順序を問わず、canonical 以外に外部（http(s): か //）を指すものがないこと
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/\srel="canonical"/i.test(tag)) continue;
    assert.doesNotMatch(tag, /\shref="(?:https?:)?\/\//i, '外部への link がない：' + tag);
  }
  assert.doesNotMatch(html, /\ssrc="(?:https?:)?\/\//i, '外部の src がない');
  // サイトのアイコン（2026-11-25）：相対パスで assets/ の固定名を指す（ICO は使わない）
  assert.deepEqual([...html.matchAll(/<link\s+rel="(icon|apple-touch-icon)"\s+href="([^"]*)"/g)].map(m => m[1] + ' ' + m[2]),
    ['icon ./assets/icon.svg', 'icon ./assets/icon-48.png', 'apple-touch-icon ./assets/icon-192.png']);
  assert.doesNotMatch(html, /\.ico\b/i);
}

/** PNG のチャンクの種類と大きさ */
function png(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG');
  const chunks = [];
  for (let i = 8; i < bytes.length; i += 12 + bytes.readUInt32BE(i)) chunks.push(bytes.toString('latin1', i + 4, i + 8));
  assert.equal(chunks[0], 'IHDR');
  assert.equal(chunks.at(-1), 'IEND');
  return {w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), chunks};
}

test('共有用の画像の元（static/og-image.png）：1200×630 の PNG で、文字情報のチャンク（パスなど）を含まない', () => {
  const p = png(readFileSync('static/og-image.png'));
  assert.deepEqual([p.w, p.h], [1200, 630]);
  assert.deepEqual(p.chunks.filter(c => /^(tEXt|iTXt|zTXt|eXIf|tIME)$/.test(c)), []);
});

test('サイトのアイコンの元（static/）：PNG は 48・192px の正方形で文字情報のチャンクを含まない。SVG は外部参照・スクリプト・メタデータを含まない', () => {
  for (const n of [48, 192]) {
    const p = png(readFileSync(`static/icon-${n}.png`));
    assert.deepEqual([p.w, p.h], [n, n]);
    assert.deepEqual(p.chunks.filter(c => /^(tEXt|iTXt|zTXt|eXIf|tIME)$/.test(c)), []);
  }
  const svg = readFileSync('static/icon.svg', 'utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 48 48">/);
  assert.doesNotMatch(svg, /<script|<metadata|href=|<!--|\son[a-z]+=/i);
});

test('画面：全国表示の題名はページの題名と同じ。ⓘ の先頭に「このサイトについて」がある', () => {
  const real = readFileSync('src/real.ts', 'utf8');
  assert.ok(real.includes(`region==='national'?'${title(src)}':`), '全国表示の題名');
  // 冒頭の見出し（2026-11-25）：wbr・br を除くと題名の前半と同じ。PC では br を出さず、幅760px 以下だけ2行にする（狭い画面は語の切れ目 wbr でだけ折り返す）
  const head = real.match(/<span class="brand-title">(.*?)<\/span>/)?.[1] ?? '';
  assert.equal(head.replace('<wbr>', '').replace('<br class="brand-br">', ''), title(src).split('｜')[0]);
  const css = readFileSync('src/real.css', 'utf8');
  assert.match(css, /\.brand-br\{display:none\}@media\(max-width:760px\)\{[^}]*\}[^@]*\.brand-br\{display:inline\}/);
  assert.match(real, /<button id="real-info-close"[^>]*>×<\/button><\/div><h3>このサイトについて<\/h3><p>[^<]*可視化[^<]*<\/p><div class="callout">/);
});

test('index.html（元）：canonical・og:url が公開サイトの URL、og:title・og:description が題名・説明と同じ', () => checkHead(src));

test('dist/index.html（ビルド後。なければ飛ばす）：同じ meta が残り、CSP の meta は1つでスクリプトより前', {skip: !existsSync('dist/index.html') && 'dist がない（公開 CI では test が build より前）'}, () => {
  const html = readFileSync('dist/index.html', 'utf8');
  checkHead(html);
  assert.equal(verification(html), verification(src), '所有確認の値が build で変わらない');
  assert.ok(readFileSync('dist/assets/og-image.png').equals(readFileSync('static/og-image.png')), '共有用の画像が元と同じ');
  for (const f of ['icon.svg', 'icon-48.png', 'icon-192.png']) assert.ok(readFileSync('dist/assets/' + f).equals(readFileSync('static/' + f)), 'アイコンが元と同じ：' + f);
  assert.ok(!existsSync('dist/favicon.ico') && !existsSync('dist/assets/favicon.ico'), 'ICO は出さない');
  const csp = [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"/gi)];
  assert.equal(csp.length, 1);
  const script = html.search(/<script\b/i);
  assert.ok(script < 0 || csp[0].index < script, 'CSP の meta がスクリプトより前');
});
