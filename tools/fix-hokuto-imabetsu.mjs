// 北斗今別直流幹線（osm-721045162-250）の表示名と別名・出典（2026-10-10 オーナー指示「A案にプラスして、名称は『北斗今別直流幹線（新北本連系）』」）。
// 線の途中のつなぎ目を接続点から外す。public/data/tohoku-dc-osm.json をその場で直す（何度実行しても同じ結果）。ID・形状は変えない。
// 一次資料の線名は「北斗今別直流幹線」（OCCTO「新北本連系設備の運用開始に伴う今後の主なスケジュール」2019-03：電圧250kV、こう長122km、北斗変換所―今別変換所）。
// 「新北本」は設備全体の名前（ほくでんネットワーク「新北本連系設備」：2019年3月運転開始、30万kW）。連系線の潮流の線名（scripts/tie-flow.mjs）と src/dc-catalog.ts も同じ表示名にそろえる。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const line = geo.lines.find(l => l.id === 'osm-721045162-250'); if (!line) throw Error('osm-721045162-250 がない');
const NAME = '北斗今別直流幹線（新北本連系）';
if (line.name !== '北斗今別直流幹線' && line.name !== NAME) throw Error('線名が想定と違う：' + line.name);
line.name = NAME;
const set = (label, value) => { line.attributes = [...(line.attributes ?? []).filter(a => a.label !== label), {label, value}]; };
set('一次資料の線名', '北斗今別直流幹線（OCCTO 2019-03：電圧250kV、こう長122km、北斗変換所―今別変換所。地中区間は青函トンネルを通る）');
set('別名', '新北本連系設備（ほくでんネットワーク）の送電線。新北本連系設備は2019年3月運転開始、容量30万kW（北海道・本州間の連系容量は60万kWから90万kWに）');
set('出典', `地理はOSM（data/raw/osm-dc.json、${geo.osmTimestamp}時点）。ほくでんネットワーク「新北本連系設備」（https://www.hepco.co.jp/network/stable_supply/efforts/north_reinforcement/index.html）、OCCTO「新北本連系設備の運用開始に伴う今後の主なスケジュール」（2019-03、https://www.occto.or.jp/oshirase/sonotaoshirase/2018/files/190313_shinkitahon_unyou_schedule.pdf）。`);
// 線の途中のつなぎ目（OSM way 801582500 と 801833266 の共有ノード 7497452684）が接続点として記録され、監査で「端点未接続」になっていた（2026-10-10 オーナー承認で外す）
const JOINT = 7497452684, raw = JSON.parse(fs.readFileSync(path.join(APP, 'data/raw/osm-dc.json'), 'utf8')).elements;
const users = raw.filter(e => e.type === 'way' && e.nodes?.includes(JOINT)).map(w => w.id);
if (users.some(id => !line.osmIds.includes(id))) throw Error('ノード 7497452684 に他の線がつながっている（OSMの更新を確認）');
line.connections = line.connections.filter(c => !(c.node === JOINT && c.status === 'shared-node'));
// 接続点を経路の順（北斗変換所 → 吉岡ケーブルヘッド → 竜飛ケーブルヘッド → 今別変換所）に並べる。カードの「区間」は最初と最後の設備を使うため、並びが崩れていると「北斗変換所→竜飛ケーブルヘッド」と出ていた
const ORDER = ['北斗変換所', '吉岡ケーブルヘッド', '竜飛ケーブルヘッド', '今別変換所'], rank = c => { const i = ORDER.indexOf(c.facilities[0]?.name); if (i < 0) throw Error('想定外の接続点：' + c.node); return i; };
line.connections = [...line.connections].sort((x, y) => rank(x) - rank(y));
fs.writeFileSync(file, JSON.stringify(geo));
console.log(line.id, line.name, line.attributes.map(a => a.label).join('・'));
