// 北本直流幹線（陸上）と名称未登録の直流線分の出典（2026-10-11 オーナー承認：送電線チェックの「出典欠落」error の解消）。
// public/data/tohoku-dc-osm.json をその場で直す（何度実行しても同じ結果）。ID・名前・形状は変えず、属性「出典」だけを足す。
// 名称未登録の3線分（way 797840188・797840190・797840191）は北本直流幹線のOSMの経路の一部（public/data/tie-flow.json の lineAliases、補助資料のみ）。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const OCCTO = 'OCCTO 連系線潮流実績「北海道・本州間電力連系設備」（北本・北斗今別の2設備の合計、https://occtonet3.occto.or.jp/public/dfw/RP11/OCCTO/SD/LOGIN_login ）';
const TARGETS = {
  'osm-184149394-250': `地理はOSM（way 184149394、data/raw/osm-dc.json、${geo.osmTimestamp}時点）。北海道・本州間の直流連系設備（北本直流幹線、事業者 電源開発）：${OCCTO}。`,
  'osm-797840188-250': `地理はOSM（way 797840188、data/raw/osm-dc.json、${geo.osmTimestamp}時点、線名なし）。北本直流幹線の経路の一部とみなす（public/data/tie-flow.json の lineAliases、補助資料のみ）。連系設備：${OCCTO}。`,
  'osm-797840190-250': `地理はOSM（way 797840190、data/raw/osm-dc.json、${geo.osmTimestamp}時点、線名なし）。北本直流幹線の経路の一部とみなす（public/data/tie-flow.json の lineAliases、補助資料のみ）。連系設備：${OCCTO}。`,
  'osm-797840191-250': `地理はOSM（way 797840191、data/raw/osm-dc.json、${geo.osmTimestamp}時点、線名なし）。北本直流幹線の経路の一部とみなす（public/data/tie-flow.json の lineAliases、補助資料のみ）。連系設備：${OCCTO}。`,
};
for (const [id, value] of Object.entries(TARGETS)) {
  const line = geo.lines.find(l => l.id === id); if (!line) throw Error(id + ' がない');
  line.attributes = [...(line.attributes ?? []).filter(a => a.label !== '出典'), {label: '出典', value}];
  console.log(id, line.name);
}
fs.writeFileSync(file, JSON.stringify(geo));
