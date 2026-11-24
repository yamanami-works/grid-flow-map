// 東北の送電線の回線数だけの公開ファイル public/data/tohoku-circuits.json を作る（2026-11-09 保留95 ⑤-b）。
// 東北電力NW の系統空容量一覧（送電線）の構造化データ network-capacity.json は、各社の表と同じく携帯用ビルドだけ（data/private/）にした。
// 公開版でも詳細パネルの「N回線」を残すため（オーナー指示「送電線のN回線の記載は残す」）、回線数と出典の名前・作成日だけをここに書き出す。
// 書くのは回線数と出典の名前・作成日・URL だけ（tests/no-capacity-values.test.mjs で項目を確かめる）。各社の空容量一覧の値（設備容量・運用容量・N-1電制・出力制御）は書かない。
// 使い方：node scripts/tohoku-circuits.mjs [入力（既定 data/private/network-capacity.json）]。scripts/import-network-capacity.mjs の最後でも呼ぶ。
import {readFile, writeFile} from 'node:fs/promises';

export const CIRCUIT_FIELDS = ['name', 'voltageKV', 'circuitCount', 'published', 'sourceUrl'];
export function circuitsFrom(network) {
  return {
    schemaVersion: 1,
    source: '東北電力ネットワーク 系統空容量（基幹系統・送電線）の回線数',
    retrievedAt: network.retrievedAt ?? null,
    // 画面は名前（正規化）と電圧が一致し、1行だけのときに使う（src/real.ts）。重複行もそのまま残す
    lines: network.lines.map(l => Object.fromEntries(CIRCUIT_FIELDS.map(k => [k, l[k] ?? null]))),
  };
}

if (process.argv[1]?.endsWith('tohoku-circuits.mjs')) {
  const input = process.argv[2] ?? 'data/private/network-capacity.json';
  const network = JSON.parse(await readFile(input, 'utf8'));
  const out = circuitsFrom(network);
  await writeFile('public/data/tohoku-circuits.json', JSON.stringify(out, null, 2) + '\n');
  console.log('tohoku-circuits:', out.lines.length, 'lines');
}
