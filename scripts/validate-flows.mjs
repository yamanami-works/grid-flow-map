// 前回分と比べる検証（2026-11-01 公開残件3-C、保留43 オーナー承認。docs/RULES.md 5節「自動配置とデータの検証」の前回との比較）。
//   node scripts/validate-flows.mjs <前回分のフォルダ> [--initial]
// 前回分は、取得の前に公開中のサイトから読み戻したもの（scripts/restore-flows.mjs）を写したフォルダ。今回分は public/data/<名前>.json。
// 10データ（SPLIT_FLOWS）それぞれ、次のどれかに当たれば失敗（終了コード1。配置しない）：
//   ① 観測のある日（有限の値を含む日）の新しい2日に、有限の値がない・すべて0
//   ② 観測のある最新の日付が、前回より古い
//   ③ 前回に観測のあった線 ID（30日分）のうち、今回も観測のある割合が8割未満（ID がそろって変わった場合も検出する）
//   ④ 符号の反転：同じ日付・線・コマで両方の絶対値が10以上の組が、全体で20組以上かつ9割以上逆、または線ごとに10組以上かつ9割以上逆
//   ⑤ 観測のある日数が前回より3日以上減る
// ⑥ 鮮度（2026-11-03 セキュリティレビュー B、保留53 オーナー承認）：観測のある最新の日付が日本時間の今日か前日でなければ「古い」。
//   古いことは配置を止めない（どの実行でも警告だけ）。ログに ::warning:: の行を出し、GITHUB_OUTPUT があれば stale=true/false を書く
//   （publish.yml は定期・手動のとき、配置の後のジョブで失敗の印を出す）。今日より後の日付は時計かデータの誤りとして失敗。--initial でも同じ。
// ⑦ 表の形の変化（2026-11-09 保留93 オーナー承認）：観測のある最新の日の実績・運用容量の行の組が、30日で最も多い組と違えば警告だけ（配置は止めない）。
//   運用容量が0行の日は「未公表」と分けて出す。線名は Actions の命令にならない形にして最大3本（scripts/flow-shape.mjs）。
// 前回分のファイルがないとき、②〜⑤は --initial（初回の配置。restore-flows と同じワークフローの入力から渡す）のときだけ飛ばす。それ以外は失敗。
import {readFile, appendFile} from 'node:fs/promises';
import path from 'node:path';
import {SPLIT_FLOWS} from './flow-split.mjs';
import {validateFlowDays} from './validate-flow.mjs';
import {shapeChange, shapeMessage} from './flow-shape.mjs';

const MIN_ID_RATIO = 0.8, FLIP_ABS = 10, FLIP_MIN_ALL = 20, FLIP_MIN_LINE = 10, FLIP_RATIO = 0.9, MAX_DAY_LOSS = 3;
const finite = day => day.actual.lines.flatMap(l => l.values.filter(Number.isFinite));
const observedDays = days => days.filter(d => d.actual.lines.some(l => l.values.some(Number.isFinite))).sort((a, b) => b.date.localeCompare(a.date));
const observedIds = days => new Set(days.flatMap(d => d.actual.lines.filter(l => l.values.some(Number.isFinite)).map(l => l.id)));

/** 1つのデータを比べる。戻り値：{errors:[理由], info:記録用の1行} */
export function compareFlow(name, prev, cur) {
  const errors = [];
  validateFlowDays(cur.days);
  const obs = observedDays(cur.days), top = obs.slice(0, 2).flatMap(finite);
  if (!top.length || top.every(v => v === 0)) errors.push('観測のある新しい2日に値がない、またはすべて0');
  if (!prev) return {errors, info: `${name}：観測のある日${obs.length}・前回分なし`};
  const pobs = observedDays(prev.days);
  if (pobs.length && (!obs.length || obs[0].date < pobs[0].date)) errors.push(`観測のある最新の日付が前回より古い（${obs[0]?.date ?? 'なし'} < ${pobs[0].date}）`);
  const pIds = observedIds(prev.days), cIds = observedIds(cur.days);
  const kept = [...pIds].filter(id => cIds.has(id)).length, ratio = pIds.size ? kept / pIds.size : 1;
  if (ratio < MIN_ID_RATIO) errors.push(`前回に観測のあった線のうち今回も観測のある割合が${(ratio * 100).toFixed(0)}%（${kept}/${pIds.size}）`);
  const curByDate = new Map(cur.days.map(d => [d.date, d]));
  // 同じ日付どうしでも比べる（30日分の和だけでは、今回取り直した日で線が大きく減っても古い日に残る ID で見逃すため）
  const lowDays = [];
  for (const pd of prev.days) {
    const cd = curByDate.get(pd.date); if (!cd) continue;
    const p = observedIds([pd]), c = observedIds([cd]), k = [...p].filter(id => c.has(id)).length;
    if (p.size && k / p.size < MIN_ID_RATIO) lowDays.push(`${pd.date} ${k}/${p.size}`);
  }
  if (lowDays.length) errors.push(`前回その日に観測のあった線のうち今回も観測のある割合が8割未満の日：${lowDays.length}日（${lowDays.slice(0, 3).join('、')}${lowDays.length > 3 ? 'ほか' : ''}）`);
  let all = 0, allFlip = 0;
  const perLine = new Map();
  for (const pd of prev.days) {
    const cd = curByDate.get(pd.date); if (!cd) continue;
    for (const pl of pd.actual.lines) {
      const cl = cd.actual.lines.find(l => l.id === pl.id); if (!cl) continue;
      const s = perLine.get(pl.id) ?? {name: pl.name ?? pl.id, n: 0, flip: 0};
      // 取り直していない日は前回と同じ値なので、値が変わった組だけを数える（取り直した1〜2日だけの反転も割合に出る）
      pl.values.forEach((v, i) => { const w = cl.values[i]; if (v !== w && Number.isFinite(v) && Number.isFinite(w) && Math.abs(v) >= FLIP_ABS && Math.abs(w) >= FLIP_ABS) { s.n++; all++; if (Math.sign(v) !== Math.sign(w)) { s.flip++; allFlip++; } } });
      perLine.set(pl.id, s);
    }
  }
  const flipped = [...perLine.values()].filter(s => s.n >= FLIP_MIN_LINE && s.flip / s.n >= FLIP_RATIO);
  if (flipped.length >= 3) errors.push(`線の符号が一斉に反転：${flipped.length}本（${flipped.slice(0, 3).map(s => s.name).join('、')}ほか）`);
  else for (const s of flipped) errors.push(`線の符号が反転：${s.name}（${s.flip}/${s.n}組）`);
  // 線ごとでは10組に届かない反転が多くの線に散らばっている場合
  if (!flipped.length && all >= FLIP_MIN_ALL && allFlip / all >= FLIP_RATIO) errors.push(`値の符号が一斉に反転（${allFlip}/${all}組）`);
  if (pobs.length - obs.length >= MAX_DAY_LOSS) errors.push(`観測のある日数が前回より${pobs.length - obs.length}日減った（${pobs.length}→${obs.length}）`);
  return {errors, info: `${name}：観測のある日${pobs.length}→${obs.length}・線 ID 継続${kept}/${pIds.size}・新規${[...cIds].filter(id => !pIds.has(id)).length}・消えた${pIds.size - kept}・比べた組${all}（逆${allFlip}）`};
}

// 日本時間の今日と前日（Actions の時計は UTC。前日は日付の文字列を UTC で1日戻す）
const jstDays = now => { const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(now); return [today, new Date(Date.parse(today) - 864e5).toISOString().slice(0, 10)]; };
/** ⑥ 鮮度。戻り値：{stale:最新の観測日（古いとき）, error:理由（未来の日付のとき）} どちらもなければ空 */
export function staleFlows(days, now = new Date()) {
  const [today, yesterday] = jstDays(now), latest = observedDays(days)[0]?.date;
  if (latest > today) return {error: `観測のある最新の日付が日本時間の今日より後（${latest} > ${today}）`};
  return latest === today || latest === yesterday ? {} : {stale: latest ?? '観測なし'};
}

const readJson = async file => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw Error(`${file} を読めない：${e.message}`); } };

/** 10データを比べる。戻り値：{errors:[データ名：理由], stale:[データ名：最新の観測日], shapes:[警告の文], info:[行]}。shapes は表の形の変化（⑦、警告だけ。scripts/flow-shape.mjs） */
export async function validateFlows({prevDir, curDir = 'public/data', initial = false, now = new Date()}) {
  const errors = [], stale = [], shapes = [], info = [];
  for (const name of SPLIT_FLOWS) {
    try {
      const cur = await readJson(path.join(curDir, name + '.json'));
      if (!cur) { errors.push(`${name}：今回分がない`); continue; }
      validateFlowDays(cur.days);
      const f = staleFlows(cur.days, now); if (f.error) errors.push(`${name}：${f.error}`); if (f.stale) stale.push(`${name}：${f.stale}`);
      // ⑦は警告だけ。判定で例外が出ても配置を止めない
      try { const c = shapeChange(cur.days); if (c) shapes.push(shapeMessage(name, c)); } catch (e) { shapes.push(`表の形の判定に失敗：${name}`); }
      const prev = await readJson(path.join(prevDir, name + '.json'));
      if (!prev && !initial) { errors.push(`${name}：前回分がない（初回でなければ配置しない）`); continue; }
      const r = compareFlow(name, prev, cur); errors.push(...r.errors.map(e => `${name}：${e}`)); info.push(r.info);
    } catch (e) { errors.push(`${name}：${e.message}`); }
  }
  return {errors, stale, shapes, info};
}

if (process.argv[1]?.endsWith('validate-flows.mjs')) {
  const args = process.argv.slice(2), dirs = args.filter(a => !a.startsWith('--'));
  if (dirs.length !== 1 || args.some(a => a.startsWith('--') && a !== '--initial')) { console.error('使い方：node scripts/validate-flows.mjs <前回分のフォルダ> [--initial]'); process.exit(2); }
  const {errors, stale, shapes, info} = await validateFlows({prevDir: dirs[0], initial: args.includes('--initial')});
  for (const l of info) console.log(l);
  for (const s of shapes) console.log('::warning::' + s);
  for (const s of stale) console.log('::warning::鮮度：観測のある最新の日付が日本時間の今日・前日でない ' + s);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `stale=${stale.length > 0}
`);
  if (errors.length) { console.error('前回比較の検証：失敗 ' + errors.length + '件'); for (const e of errors) console.error('  ' + e); process.exit(1); }
  console.log('前回比較の検証：成功');
}
