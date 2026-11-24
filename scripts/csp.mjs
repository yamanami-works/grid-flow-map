// CSP（Content-Security-Policy。2026-10-12 オーナー承認）
// 外部の読み込み先は国土地理院の背景地図（img-src）だけ。フォントは端末の標準フォントで外部から読まない。
// vite.config.ts が本番ビルドの index.html に <meta> で入れ、scripts/check-publish.mjs が中身を確かめる。
export const CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https://cyberjapandata.gsi.go.jp'],
  'connect-src': ["'self'"],
  'font-src': ["'self'"],
  'base-uri': ["'none'"],
  'object-src': ["'none'"],
  'form-action': ["'none'"],
};
export const CSP = Object.entries(CSP_DIRECTIVES).map(([k, v]) => k + ' ' + v.join(' ')).join('; ');

// 公開前チェック用：CSP の文字列を確かめ、問題の一覧を返す（空なら合格）。
// 許可先は 'self'・data:・https://cyberjapandata.gsi.go.jp だけ（data: と地理院は img-src だけ）。
// キーワードは 'none' と、style-src の 'unsafe-inline'（地図部品と画面が要素の style を使うため）だけを認める。
const ALLOWED = {"'self'": null, 'data:': ['img-src'], 'https://cyberjapandata.gsi.go.jp': ['img-src'], "'none'": null, "'unsafe-inline'": ['style-src']};
const REQUIRED = {'default-src': "'none'", 'script-src': "'self'", 'object-src': "'none'", 'base-uri': "'none'"};
export function cspProblems(csp) {
  if (!csp) return ['CSP がない'];
  const errors = [], dirs = new Map();
  for (const part of csp.split(';').map(s => s.trim()).filter(Boolean)) { const [name, ...sources] = part.split(/\s+/); dirs.set(name.toLowerCase(), sources); }
  for (const [name, sources] of dirs) for (const s of sources) {
    if (!(s in ALLOWED)) errors.push(`CSP の許可先が許可リストにない：${name} ${s}`);
    else if (ALLOWED[s] && !ALLOWED[s].includes(name)) errors.push(`CSP の ${s} は ${ALLOWED[s].join('・')} 以外で使えない：${name}`);
  }
  for (const [name, value] of Object.entries(REQUIRED)) { const v = dirs.get(name); if (!v || v.join(' ') !== value) errors.push(`CSP の ${name} が ${value} でない：${v ? v.join(' ') : 'なし'}`); }
  return errors;
}
