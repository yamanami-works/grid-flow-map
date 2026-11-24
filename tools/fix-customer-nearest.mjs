// 実名未確認の需要家の名称を、古い東北のOSMデータ（public/data/tohoku-trunk-osm.json）の「最寄り設備」の記録から外す（2026-10-13 オーナー承認）。
// このファイルは配布物（dist/）には入らないが、テスト・各地域のビルドが読むため公開リポジトリに含める。docs/RULES.md 3節「需要家」に合わせ、
// docs/research/customer-aux-names.json にある設備について、最寄り設備（nearest）・線の接続先・設備の登録の名前を表示名（「需要家」）に置き換え、
// 設備の登録から事業者の属性とOSMの設備ページへのリンクを外す。その場で直す（何度実行しても同じ結果）。
// 線・設備の件数・ID・形状は変えない。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..');
const file = path.join(APP, 'public/data/tohoku-trunk-osm.json'), internal = path.join(APP, 'docs/research/customer-aux-names.json');
const ids = new Set(JSON.parse(fs.readFileSync(internal, 'utf8')).entries.map(e => e.facilityId).filter(Boolean)); // 設備の項目だけ（線の項目 lineId・osmWayIds は除く）
const text = fs.readFileSync(file, 'utf8'), geo = JSON.parse(text.replace(/^﻿/, ''));
let n = 0;
const walk = o => { if (Array.isArray(o)) { o.forEach(walk); return; } if (!o || typeof o !== 'object') return;
  // 最寄り設備・接続先・設備の登録のどこでも、この設備のIDを持つ記録の名前は「需要家」。設備の登録からは事業者の属性とOSMのページへのリンクも外す
  if (ids.has(o.id) && typeof o.name === 'string' && o.name !== '需要家') { o.name = '需要家'; n++; }
  if (ids.has(o.id) && o.kind) { if (o.url) { o.url = ''; n++; } const before = (o.attributes ?? []).length; o.attributes = (o.attributes ?? []).filter(a => !/^(運営者|事業者)$/.test(a.label)); n += before - o.attributes.length; }
  for (const v of Object.values(o)) walk(v); };
walk(geo);
fs.writeFileSync(file, JSON.stringify(geo));
console.log('置き換え・削除した件数', n);
