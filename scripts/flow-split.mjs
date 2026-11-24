// 潮流データの分割（2026-10-10 オーナー承認「潮流の分割読み込み」）。30日分のファイル（public/data/<名前>.json）はそのまま残し、
// 画面用に次を書く：
//   <名前>-latest.json：最新日1日分（days）と、日付・中身のハッシュの一覧（index、新しい順）。連系線の lineAliases などの付帯情報もそのまま
//   <名前>-days/<日付>.json：1日分ずつ。画面は過去日を選んだ時に <日付>.json?v=<ハッシュ> で読む（中身が変わればハッシュが変わり、新しい中身を読む）
// 観測値のない日は入れない（画面の validDays と同じ扱い）。30日の窓（index）から外れた日のファイルは削除する。
// 書く順番：1日分のファイル → latest → 古い日の削除（latest が指す日のファイルが必ずある）。
// 呼び出し元：scripts/occto-publication.mjs の publishFile（各地域の更新）、scripts/tie-flow.mjs（連系線）、scripts/prepare-foundation.mjs（ビルド時に全部）
import {readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, unlinkSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const SPLIT_FLOWS = ['occto-tohoku', 'hokkaido-flow', 'tokyo-flow', 'chubu-flow', 'hokuriku-flow', 'kansai-flow', 'chugoku-flow', 'shikoku-flow', 'kyushu-flow', 'tie-flow'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const hasObservation = d => d?.actual?.lines?.some(l => l.values?.some(Number.isFinite));
const writeAtomic = (file, text) => { if (existsSync(file) && readFileSync(file, 'utf8') === text) return; writeFileSync(file + '.tmp', text); renameSync(file + '.tmp', file); };
export const hashOf = text => createHash('sha256').update(text).digest('hex').slice(0, 12);
/** public/data/<名前>.json から latest と1日分のファイルを書き、窓の外の日のファイルを消す。戻り値：{index, removed} */
export function writeFlowSplit(file) {
  const {days = [], ...rest} = JSON.parse(readFileSync(file, 'utf8'));
  const valid = days.filter(d => DAY.test(d?.date ?? '') && hasObservation(d)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const dir = file.replace(/\.json$/, '-days');
  mkdirSync(dir, {recursive: true});
  const index = valid.map(d => { const text = JSON.stringify(d); writeAtomic(path.join(dir, d.date + '.json'), text); return {date: d.date, hash: hashOf(text)}; });
  writeAtomic(file.replace(/\.json$/, '-latest.json'), JSON.stringify({...rest, days: valid.slice(0, 1), index}));
  const keep = new Set(index.map(e => e.date + '.json')), removed = [];
  for (const f of readdirSync(dir)) if (!keep.has(f)) { unlinkSync(path.join(dir, f)); removed.push(f); }
  return {index, removed};
}
if (process.argv[1]?.endsWith('flow-split.mjs')) {
  for (const name of SPLIT_FLOWS) { const f = `public/data/${name}.json`; if (!existsSync(f)) continue; const r = writeFlowSplit(f); console.log(name, r.index.length + '日', r.removed.length ? '削除 ' + r.removed.join(',') : ''); }
}
