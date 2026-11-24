// 北本直流幹線（陸上、osm-184149394-250）の端点未接続の修正（2026-10-11 オーナー承認：送電線チェックの error の解消）。
// public/data/tohoku-dc-osm.json をその場で直す（何度実行しても同じ結果）。ID・名前は変えない。
// - 函館変換所側の端（node 1940701625）は、電源開発株式会社北地域制御所（＝函館変換所）の区画（OSM way 262597732）の内側。ほかの2つの端と同じく設備につなぐ。
// - 海底ケーブル区間側の端（node 1945909893）は、OSMの線分がケーブル区間との接続点（node 2509891803）の約40m手前で止まっている（OSMの描き残し）。
//   北本直流幹線が陸上区間から海底ケーブル区間へ続くことは電源開発の公表資料で確認済み（tools/fix-hokuhon-cable.mjs）。この間を直線（破線・ルート不明）で補う。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const line = geo.lines.find(l => l.id === 'osm-184149394-250'); if (!line) throw Error('osm-184149394-250 がない');
const cable = geo.lines.find(l => l.id === 'osm-244040213-250'); if (!cable) throw Error('osm-244040213-250 がない');
const STATION = {id: 'osm-way-262597732', name: '電源開発株式会社北地域制御所'};
if (!geo.facilities.some(f => f.id === STATION.id)) throw Error('北地域制御所の設備がない');
const dm = (a, b) => Math.round(Math.hypot((a[0] - b[0]) * 110540, (a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180)));
const notes = [];
// 1) 函館変換所側
{ const c = line.connections.find(x => x.node === 1940701625);
  if (c) { const [lat, lon] = c.position; if (!(lat >= 41.9303694 && lat <= 41.9336083 && lon >= 140.6620031 && lon <= 140.6653199)) throw Error('node 1940701625 が区画の外');
    c.status = 'facility-area'; c.facilities = [STATION]; }
  notes.push('函館変換所側の端（node 1940701625）は北地域制御所（函館変換所）の区画（OSM way 262597732）の内側なので設備につないだ'); }
// 2) 海底ケーブル区間側：約40mの直線
{ const JUNCTION = cable.connections.find(x => x.node === 2509891803); if (!JUNCTION) throw Error('ケーブル区間の接続点 2509891803 がない');
  const GAP = -19459098931, k = line.connections.findIndex(x => x.node === 1945909893);
  if (k >= 0) { const from = line.connections[k].position, d = dm(from, JUNCTION.position); if (d > 100) throw Error('ケーブル区間の接続点まで遠すぎる ' + d);
    line.paths.push([from, JUNCTION.position]); line.osmIds.push(GAP); line.connections.splice(k, 1); }
  if (!line.osmIds.includes(GAP)) throw Error('直線の補完がない');
  line.schematicParts = [...(line.schematicParts ?? []).filter(s => s.osmId !== GAP), {osmId: GAP, construction: 'unknown'}];
  notes.push(`海底ケーブル区間側の端（node 1945909893）は、OSMの線分がケーブル区間との接続点（node 2509891803）の約${dm(line.paths[line.osmIds.indexOf(GAP)][0], JUNCTION.position)}m手前で止まっているため、この間を直線（破線・ルート不明）で補った。陸上区間からケーブル区間へ続くことは電源開発の公表資料で確認（tools/fix-hokuhon-cable.mjs）`); }
line.attributes = [...(line.attributes ?? []).filter(a => a.label !== '端の修正（2026-10-11）'), {label: '端の修正（2026-10-11）', value: notes.join('。') + '。'}];
fs.writeFileSync(file, JSON.stringify(geo));
console.log(line.id, line.connections.map(c => c.status + ':' + (c.facilities.map(f => f.name).join('') || c.node)).join(' / '));
