// 操作デモ（架空の系統・潮流）は開発中だけ開ける。公開用のビルドには入れない（2026-11-03）
if (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') === 'demo') {
  void import('./demo');
} else {
  void import('./real');
}
