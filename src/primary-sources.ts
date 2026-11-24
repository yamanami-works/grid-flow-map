// 全国共通の実績出典。地域別の容量・予想潮流資料とは区別する。
export const actualFlowSource = {
  label: '潮流：OCCTO系統情報サービス（公式）',
  url: 'https://www.occto.or.jp/institution/keitoujouhou/index.html',
};
// 一次情報欄の地域の資料の前に置く1行（2026-11-03）
export const regionSourceNote = '系統情報は一般送配電会社の資料を参照';

// 地域ごとの一次情報：各社が公表する「系統マップ」と、そのマップに記載された番号の一覧（予想潮流・空容量）に絞る（2026-10-06）。例外：中国は設備の計画の資料（中国電力NWの設備形成計画、OCCTOの供給計画の取りまとめ）も載せる（2026-10-25）。北海道は系統構成（実績）も追加（同日）。
// 年月入りのファイル名（東北・北陸・四国・九州）は各社の更新で変わるため、リンク切れの時は掲載ページから差し替える。
// 掲載ページ：北海道 hepco.co.jp/network/con_service/public_document/bid_info.html、東北 nw.tohoku-epco.co.jp/consignment/system/announcement/、
// 東京 tepco.co.jp/pg/consignment/system/index-j.html、中部 powergrid.chuden.co.jp/goannai/hatsuden_kouri/takuso_kyokyu/rule/map/、
// 北陸 rikuden.co.jp/nw_notification/U_154seiyaku.html、関西 kansai-td.co.jp/consignment/disclosure/distribution-equipment/index.html、
// 中国 energia.co.jp/nw/service/retailer/keitou/access/、四国 yonden.co.jp/nw/line_access/data.html、九州 kyuden.co.jp/td/service/wheeling/disclosure.html
export type SourceLink = { label: string; url: string };
export const regionMapSources: Record<'hokkaido' | 'tohoku' | 'tokyo' | 'chubu' | 'hokuriku' | 'kansai' | 'chugoku' | 'shikoku' | 'kyushu', SourceLink[]> = {
  hokkaido: [
    { label: '187kV以上系統 混雑状況マップ・予想潮流等一覧表（北海道電力NW・PDF）', url: 'https://www.hepco.co.jp/network/con_service/public_document/pdf/map_forecast_tide_list.pdf' },
    { label: '187kV以上系統 系統構成（実績・北海道電力NW・PDF）', url: 'https://www.hepco.co.jp/network/con_service/public_document/pdf/sys_config_results.pdf' }],
  tohoku: [
    { label: '基幹系統の系統状況マップ（東北電力NW・PDF）', url: 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/pdf/sys_capa_kikan01_map_202608_02.pdf' },
    { label: '基幹系統 送電線の予想潮流等一覧表（マップの番号・PDF）', url: 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/pdf/sys_capa_kikan01_line_202607_02.pdf' },
  ],
  // 2026-11-17：2019年の旧版（発電所名・電源線名が系統図に載る）を、今の資料はそのままに追加。表のリンク（tableLink＝最後の項目）は今の資料のままにするため、旧版を先に置く。記録は docs/research/tokyo-akiyouryou-2019.md
  tokyo: [
    { label: '275kV以上系統 空容量マッピング・運用容量一覧表（東京PG・2019年4月24日作成の旧版・PDF）', url: 'https://www.tepco.co.jp/pg/consignment/system/pdf/akiyouryou_kikan.pdf' },
    { label: '基幹系統の予想潮流マップ・一覧表（東京PG・PDF）', url: 'https://www.tepco.co.jp/pg/consignment/system/pdf/kikan_yosochoryu.pdf' },
  ],
  chubu: [{ label: '系統空容量・予想潮流マッピング（中部PG・地図と設備ごとの一覧）', url: 'https://gridmap.powergrid.chuden.co.jp/' }],
  hokuriku: [
    { label: '予想潮流・空容量マップ（154kV以上・北陸電力送配電・PDF）', url: 'https://www.rikuden.co.jp/nw_notification/attach/keitouzu154.pdf' },
    { label: '予想潮流・空容量（送電線）一覧（マップの番号・PDF）', url: 'https://www.rikuden.co.jp/nw_notification/attach/sys_capa_kikan01_line_202609_05.pdf' },
  ],
  kansai: [
    { label: 'マッピング（154kV以上・関西電力送配電・PDF）', url: 'https://www.kansai-td.co.jp/interchange/takusou/pdf/154kv_more_mapping.pdf' },
    { label: '空容量一覧（154kV以上・マップの番号・PDF）', url: 'https://www.kansai-td.co.jp/interchange/takusou/pdf/154kv_more_space.pdf' },
  ],
  // 2026-10-25：設備の新設・増強・廃止の計画の資料も載せる（地域の表のリンク tableLink は最後の項目なので、マップと一覧を最後に置く）
  chugoku: [
    { label: '中国エリアの送変電設備形成計画の概要（中国電力NW・2026年3月30日・PDF）', url: 'https://www.energia.co.jp/nw/press/assets/2025/np20260330-1a.pdf' },
    { label: '2026年度供給計画の取りまとめ（電力広域的運営推進機関・2026年3月30日・PDF）', url: 'https://www.occto.or.jp/assets/hyougiinkai/002734/2025_4_1.pdf' },
    { label: '予想潮流・空容量マップと一覧（220kV以上・中国電力NW・PDF）', url: 'https://www.energia.co.jp/nw/service/retailer/keitou/access/pdf/mapping.pdf' },
  ],
  shikoku: [{ label: '基幹系（187kV以上）の系統図と予想潮流等一覧（四国電力送配電・PDF）', url: 'https://www.yonden.co.jp/nw/assets/line_access/data/sys_capa_kikan00_map_202611_08.pdf' }],
  kyushu: [{ label: '予想潮流等のマップと空き容量一覧表（九州電力送配電・PDF、番号から詳細へ）', url: 'https://www.kyuden.co.jp/var/rev0/0925/6793/td_renkeimap_260930.pdf' }],
};
export const primarySources = regionMapSources.tohoku;
