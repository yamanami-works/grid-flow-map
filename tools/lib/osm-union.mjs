// app/data/raw の全取得（地域ごと・電源開発など）を合わせたOSMの要素（同じIDは1回）。
import fs from 'node:fs';
import path from 'node:path';
export function loadUnion(APP, skip = ['tso-lines']) {
  const els = new Map();
  for (const dir of fs.readdirSync(path.join(APP, 'data/raw'))) {
    const p = path.join(APP, 'data/raw', dir); if (!fs.statSync(p).isDirectory() || skip.includes(dir) || /^occto/.test(dir)) continue; // OCCTOの潮流の原本はOSMではない（取得中のファイルで読み込みが止まることもある）
    for (const f of fs.readdirSync(p)) { if (!f.endsWith('.json') || f === 'source.json') continue; const t = fs.readFileSync(path.join(p, f), 'utf8').replace(/^﻿/, ''); if (!t.trimStart().startsWith('{')) continue; let j; try { j = JSON.parse(t); } catch { continue; } for (const e of j.elements ?? []) { const k = e.type + '/' + e.id; const o = els.get(k); if (!o || (!o.tags && e.tags) || (!o.geometry && e.geometry)) els.set(k, { ...o, ...e }); } }
  }
  const nodes = new Map(); for (const [, e] of els) if (e.type === 'node' && e.lat != null) nodes.set(e.id, [e.lat, e.lon]);
  const ways = [...els.values()].filter(e => e.type === 'way' && /^(line|cable)$/.test(e.tags?.power ?? '') && e.nodes?.length > 1);
  const facEl = [...els.values()].filter(e => e.tags && /^(substation|plant)$/.test(e.tags.power) && e.type !== 'node' && (e.geometry || e.members));
  return { els, nodes, ways, facEl };
}
