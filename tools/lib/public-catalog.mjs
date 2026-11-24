// 公開用のカタログ：携帯用だけのデータ（distribution:'private-preview'。各社の表）を除く（2026-10-12）。
// 公開ビルド（vite.config.ts の catalog-public-data）と同じ扱いを、テスト用マップ（tools/serve-readonly.mjs）でも使う。
export function publicCatalog(raw) {
  return {...raw, datasets: raw.datasets.filter(d => d.distribution !== 'private-preview')};
}
