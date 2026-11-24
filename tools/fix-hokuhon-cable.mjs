// 北本直流幹線の海底ケーブル区間（osm-244040213-250）の表示名と出典（2026-10-10 オーナー承認）。表示名は「北本直流幹線」（カッコの「海底ケーブル区間」は 2026-11-07 オーナー指示で削除。海底区間であることは属性「敷設場所」と線種で示す）。public/data/tohoku-dc-osm.json をその場で直す（何度実行しても同じ結果）。
// OSMの登録名「HVDC Hokkaido-Honschu」（綴りは登録のまま。陸上の北本直流幹線の英語名は「HVDC Hokkaido-Honshu」）は、津軽海峡を渡る海底区間（敷設場所 underwater）。
// 地理の対応（北本直流幹線の一部であること）はOSMの位置・電圧・つながりによるもので補助資料のみ。北本連系設備に海底ケーブルがあることは電源開発の公表資料で確認。
// 線のID・資産ID・形状は変えない（連系線の潮流は scripts/tie-flow.mjs の lineAliases でIDから北本直流幹線に当てている）。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const line = geo.lines.find(l => l.id === 'osm-244040213-250'); if (!line) throw Error('osm-244040213-250 がない');
const OSM_NAME = 'HVDC Hokkaido-Honschu';
if (![OSM_NAME, '北本直流幹線（海底ケーブル区間）', '北本直流幹線'].includes(line.name)) throw Error('線名が想定と違う：' + line.name);
line.name = '北本直流幹線';
const set = (label, value) => { line.attributes = [...(line.attributes ?? []).filter(a => a.label !== label), {label, value}]; };
set('OSMの登録名', `${OSM_NAME}（綴りは登録のまま。陸上の北本直流幹線の英語名は「HVDC Hokkaido-Honshu」）`);
// 照合の根拠の文は tools/fix-dc-tiers.mjs の CABLE_REASON と同じ（2026-11-04 保留72で「OSM 線分との対応は補助資料のみ」と読める形に直した。このあと fix-dc-tiers.mjs も実行する）
set('照合の根拠', '公表区間なし（連系線）。北本連系設備に海底ケーブル（2012年12月から計4条）があることは電源開発の公表資料（「北海道・本州間電力連系設備 新設ケーブルの使用開始について」2012-12-10）で確認。この OSM 線分（津軽海峡を渡る海底区間、敷設場所 underwater、直流250kV、陸上の北本直流幹線の線分との共有ノード）を海底ケーブル区間とみなした対応は補助資料（OSM）のみ。');
set('潮流', '連系線の潮流は北本直流幹線と同じ経路として表示（OCCTO連系線潮流実績「北海道・本州間電力連系設備」、北本・北斗今別の2設備の合計）。');
set('出典', `地理はOSM（way 244040213・254244873、data/raw/osm-dc.json、${geo.osmTimestamp}時点）。電源開発「北海道・本州間電力連系設備 新設ケーブルの使用開始について」（2012-12-10、https://www.jpower.co.jp/news/2012/12/oshirase121210.html）。`);
fs.writeFileSync(file, JSON.stringify(geo));
console.log(line.id, line.name, line.attributes.map(a => a.label).join('・'));
