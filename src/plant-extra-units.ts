// 自動生成（app/tools/build-plant-sources.mjs）。HJKS にない号機（廃止措置中・建設中）。元は docs/research/plant-primary-sources.json の unitsNotInHjks。
export type PlantExtraUnit = {name: string; mw: number; start: string | null; status: '廃止措置中' | '建設中'; source: string; url: string; checkedAt: string};
export const plantExtraUnits: Record<string, PlantExtraUnit[]> = {
 "osm-way-172644773": [
  {
   "name": "1号機",
   "mw": 559,
   "start": "1975-10-15",
   "status": "廃止措置中",
   "source": "原子力規制委員会「九州電力株式会社　玄海原子力発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/genkai_index.html",
   "checkedAt": "2026-11-10"
  }
 ],
 "osm-way-449155824": [
  {
   "name": "1号機",
   "mw": 357,
   "start": "1970-03-14",
   "status": "廃止措置中",
   "source": "原子力規制委員会「日本原子力発電株式会社　敦賀発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/tsuruga_index.html",
   "checkedAt": "2026-11-10"
  }
 ],
 "osm-way-605382253": [
  {
   "name": "1号機",
   "mw": 460,
   "start": "1974-03-29",
   "status": "廃止措置中",
   "source": "原子力規制委員会「中国電力株式会社　島根原子力発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/shimane_index.html",
   "checkedAt": "2026-11-10"
  },
  {
   "name": "3号機",
   "mw": 1373,
   "start": null,
   "status": "建設中",
   "source": "中国電力「増設計画概要」（島根原子力発電所3号機）",
   "url": "https://www.energia.co.jp/atom/atom13-1.html",
   "checkedAt": "2026-10-18"
  }
 ],
 "osm-way-605420905": [
  {
   "name": "1号機",
   "mw": 340,
   "start": "1970-11-28",
   "status": "廃止措置中",
   "source": "原子力規制委員会「関西電力株式会社　美浜発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/mihama_index.html",
   "checkedAt": "2026-11-10"
  },
  {
   "name": "2号機",
   "mw": 500,
   "start": "1972-07-25",
   "status": "廃止措置中",
   "source": "原子力規制委員会「関西電力株式会社　美浜発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/mihama_index.html",
   "checkedAt": "2026-11-10"
  }
 ],
 "osm-way-806310370": [
  {
   "name": "1号機",
   "mw": 540,
   "start": "1976-03-17",
   "status": "廃止措置中",
   "source": "原子力規制委員会「中部電力株式会社　浜岡原子力発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/hamaoka_index.html",
   "checkedAt": "2026-11-10"
  },
  {
   "name": "2号機",
   "mw": 840,
   "start": "1978-11-29",
   "status": "廃止措置中",
   "source": "原子力規制委員会「中部電力株式会社　浜岡原子力発電所の規制」（発電所別情報。作成日の記載なし）",
   "url": "https://www.nra.go.jp/hatsudensho/hamaoka_index.html",
   "checkedAt": "2026-11-10"
  }
 ]
};
