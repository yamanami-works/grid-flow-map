// Reference descriptions, not a verified OSM topology or operating-capacity join.
export const dcReferences = [
  { name: '北本直流幹線', from: '函館変換所', to: '上北変換所', voltage: 'DC ±250 kV', source: 'J-POWER 統合報告書2025', url: 'https://www.jpower.co.jp/ir/pdf/rep2025/jpower_integrated2025_all_print.pdf' },
  { name: '北斗今別直流幹線（新北本連系）', from: '北斗変換所', to: '今別変換所', voltage: 'DC 250 kV', source: 'ほくでんネットワーク 新北海道本州間連系設備の概要（2019年）', url: 'https://www.hepco.co.jp/info/2018/__icsFiles/afieldfile/2019/03/28/190328.pdf' },
];
// 北海道・本州間の連系線（2026-10-10）：OCCTOの運用容量・潮流は「北海道・本州間電力連系設備」（北本・新北本の2設備合計）の値。
// 線ごとの設備容量は各社の公表値。新北本は増強工事で60万kW（合計120万kW）になる計画（完成時期は一次資料で未確認）。
const HOKUHON_GROUP = '北海道・本州間電力連系設備（北本・新北本の2設備合計）の運用容量（OCCTO、30分値）。この線だけの値ではありません';
const HOKUHON = { group: HOKUHON_GROUP, equipmentMW: 600, equipmentNote: '北本連系設備（電源開発）', source: { name: '電源開発 北海道・本州間電力連系設備 新設ケーブルの使用開始について', date: '2012-12-10', url: 'https://www.jpower.co.jp/news/2012/12/oshirase121210.html' } };
export const tieCapacityNotes: Record<string, { group: string; equipmentMW: number; equipmentNote: string; plan?: string; source: { name: string; date: string; url: string } }> = {
  '北本直流幹線': HOKUHON,
  '北斗今別直流幹線（新北本連系）': { group: HOKUHON_GROUP, equipmentMW: 300, equipmentNote: '新北本連系設備（ほくでんネットワーク）、現在', plan: '増強工事で600 MW（2設備合計1,200 MW）になる計画。完成時期は一次資料で未確認', source: { name: 'ほくでんネットワーク 新北本連系設備', date: '', url: 'https://www.hepco.co.jp/network/stable_supply/efforts/north_reinforcement/index.html' } },
};
