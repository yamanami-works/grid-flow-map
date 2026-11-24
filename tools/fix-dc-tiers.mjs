// 直流の追加範囲（public/data/tohoku-dc-osm.json）の6本に照合区分（確度）を付ける（2026-11-04 オーナー承認 保留72：6本とも C、推測は付けない）。
// 海底ケーブル区間の照合の根拠（CABLE_REASON）は tools/fix-hokuhon-cable.mjs と同じ文にしておく。
// 前例：阿南紀北直流幹線（関西・四国）・飛騨信濃直流幹線（東京）は C（公表区間なし・連系線）。設備は一次資料で確認、どの OSM 線分がそれかの対応は OSM による。
// その場で直す（何度実行しても同じ結果）。ID・資産ID・名前・形・端点・osmIds は変えない。tools/fix-hokuhon-cable.mjs を実行したあとは、これも実行する。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..'), file = path.join(APP, 'public/data/tohoku-dc-osm.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const OCCTO_TIE = 'OCCTO 連系線潮流実績「北海道・本州間電力連系設備」（北本・北斗今別の2設備の合計）に 2026-11-04 の掲載を確認';
const CABLE_REASON = '公表区間なし（連系線）。北本連系設備に海底ケーブル（2012年12月から計4条）があることは電源開発の公表資料（「北海道・本州間電力連系設備 新設ケーブルの使用開始について」2012-12-10）で確認。この OSM 線分（津軽海峡を渡る海底区間、敷設場所 underwater、直流250kV、陸上の北本直流幹線の線分との共有ノード）を海底ケーブル区間とみなした対応は補助資料（OSM）のみ。';
const REASONS = {
  'osm-184149394-250': `公表区間なし（連系線）。設備は ${OCCTO_TIE}。経路は OSM。`,
  'osm-721045162-250': '公表区間なし（連系線）。両端（北斗変換所―今別変換所）は OCCTO「新北本連系設備の運用開始に伴う今後の主なスケジュール」（2019-03）で確認。経路は OSM。',
  'osm-244040213-250': CABLE_REASON,
  'osm-797840188-250': `公表区間なし（連系線）。線名のない OSM 線分を北本直流幹線の経路の一部とみなした（対応は補助資料のみ）。設備は ${OCCTO_TIE}。`,
  'osm-797840190-250': `公表区間なし（連系線）。線名のない OSM 線分を北本直流幹線の経路の一部とみなした（上北変換所側、対応は補助資料のみ）。設備は ${OCCTO_TIE}。`,
  'osm-797840191-250': `公表区間なし（連系線）。線名のない OSM 線分を北本直流幹線の経路の一部とみなした（上北変換所側、対応は補助資料のみ）。設備は ${OCCTO_TIE}。`,
};
const NOTE = '公表区間がなく、経路は OSM の地理登録で描いた参考表示（理由は照合の根拠）。';
for (const [id, why] of Object.entries(REASONS)) {
  const line = geo.lines.find(l => l.id === id); if (!line) throw Error(id + ' がない');
  const rest = (line.attributes ?? []).filter(a => !['要注意（C区分）', '照合区分', '照合の根拠'].includes(a.label));
  line.attributes = [{label: '要注意（C区分）', value: NOTE}, {label: '照合区分', value: 'C区分'}, {label: '照合の根拠', value: why}, ...rest];
}
fs.writeFileSync(file, JSON.stringify(geo));
console.log('直流6本を C区分にした', Object.keys(REASONS).join('・'));
