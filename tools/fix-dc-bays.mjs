// 変換所の構内の引込（OSM line=bay、名前なし）を送電線として描かない（2026-10-10 オーナー承認。前後の図は reports/line-audit/images/bay-*.svg）。
// 対象：北斗変換所の way 801582499、今別変換所の way 801612155。どちらも両端が変換所の区画内で、北斗今別直流幹線（新北本連系）の端につながる構内の部分。
// public/data/tohoku-dc-osm.json をその場で直す（何度実行しても同じ結果）。削除は tests/baseline/approved-removals.json に登録。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(APP, 'data/raw/osm-dc.json'), 'utf8')).elements;
const BAYS = {'osm-801582499-250': '北斗変換所', 'osm-801612155-250': '今別変換所'};
for (const [id, station] of Object.entries(BAYS)) {
  const l = geo.lines.find(x => x.id === id); if (!l) continue; // すでに外した
  const w = raw.find(e => e.type === 'way' && e.id === l.osmIds[0]);
  if (l.osmIds.length !== 1 || w?.tags?.line !== 'bay' || w.tags.name) throw Error(id + ' が想定（名前なしの line=bay 1線分）と違う');
  if (!l.connections.every(c => c.facilities.some(f => f.name === station))) throw Error(id + ' の両端が ' + station + ' の区画内でない');
  geo.lines = geo.lines.filter(x => x.id !== id);
  console.log('外した', id, station);
}
fs.writeFileSync(file, JSON.stringify(geo));
