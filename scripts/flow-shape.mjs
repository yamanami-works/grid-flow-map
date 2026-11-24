// 2026-11-09 保留93（オーナー回答「(a) で承認」）：潮流データの「表の形」（実績の行の ID の組と、運用容量の行の ID の組）。
// OCCTO の表は日によって形が変わることがある（例：北海道 10/29・11/9 は運用容量に北幌延線の行がない）。
// テストは「いつもの形の最新の日」で行い（typicalDay）、最新日の形の変化は検証の警告で知らせて配置は止めない（shapeChange、scripts/validate-flows.mjs）。docs/RULES.md 5節。
// ID は10データとも、日をまたいでも同じ行（線名・両端・電圧）を指す（2026-11-09 確認）ので ID で比べる。

const observed = days => (days ?? []).filter(d => d.actual?.lines?.some(l => l.values.some(Number.isFinite))).sort((a, b) => b.date.localeCompare(a.date));
const key = rows => JSON.stringify((rows ?? []).map(r => r.id).sort());
/** 日数の最も多い形。同じ日数なら新しい日の形（days は新しい順） */
const mode = keys => { const n = new Map(); for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1); let best = null; for (const k of keys) if (best === null || n.get(k) > n.get(best)) best = k; return best; };

/** 観測のある日の、実績・運用容量それぞれ最も多い形。運用容量が0行（未公表）の日は運用容量の数に入れない */
export function typicalShapes(days) {
  const obs = observed(days);
  return {actual: mode(obs.map(d => key(d.actual.lines))), capacity: mode(obs.filter(d => d.capacities?.length).map(d => key(d.capacities)))};
}

/** 実績・運用容量の両方がいつもの形の、最新の日。運用容量の行がある日が1日もないデータは実績だけで選ぶ。そろう日がなければ例外 */
export function typicalDay(flow) {
  const s = typicalShapes(flow.days), day = observed(flow.days).find(d => key(d.actual.lines) === s.actual && (s.capacity === null || key(d.capacities) === s.capacity));
  if (!day) throw Error('実績と運用容量がいつもの形でそろう日がない');
  return day;
}

/** 線名を Actions のログに出す形にする（制御文字を除き、% CR LF を符号にする。:: は命令の区切りにならないよう全角にする） */
export const logSafe = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/[\u0000-\u001f\u007f]/g, '').replace(/::/g, '：：');

/** 観測のある最新の日の形を、いつもの形と比べる。戻り値：{date, actual:{added,removed}, capacity:{added,removed}|'未公表'} 変わらなければ null */
export function shapeChange(days) {
  const latest = observed(days)[0]; if (!latest) return null;
  const s = typicalShapes(days), diff = (rows, typical) => {
    const now = new Set((rows ?? []).map(r => r.id)), base = new Set(JSON.parse(typical ?? '[]')), names = new Map((rows ?? []).map(r => [r.id, r.name]));
    for (const d of observed(days)) for (const r of [...d.actual.lines, ...(d.capacities ?? [])]) if (!names.has(r.id)) names.set(r.id, r.name);
    const pick = ids => ({count: ids.length, names: ids.slice(0, 3).map(id => logSafe(names.get(id) ?? id))});
    return {added: pick([...now].filter(id => !base.has(id))), removed: pick([...base].filter(id => !now.has(id)))};
  };
  const actual = diff(latest.actual.lines, s.actual);
  const capacity = s.capacity === null ? null : latest.capacities?.length ? diff(latest.capacities, s.capacity) : '未公表';
  const changed = x => x && x !== '未公表' && (x.added.count || x.removed.count);
  return changed(actual) || changed(capacity) || capacity === '未公表' ? {date: latest.date, actual, capacity} : null;
}

/** ログの1行（::warning:: の後ろ） */
export function shapeMessage(name, c) {
  c = {...c, date: logSafe(c.date)};
  const part = (label, x) => `${label} +${x.added.count}行${x.added.names.length ? '（' + x.added.names.join('、') + '）' : ''}・−${x.removed.count}行${x.removed.names.length ? '（' + x.removed.names.join('、') + '）' : ''}`;
  if (c.capacity === '未公表' && !(c.actual.added.count || c.actual.removed.count)) return `運用容量が未公表：${name} ${c.date}`;
  return `表の形の変化：${name} ${c.date} ${part('実績', c.actual)}${c.capacity === '未公表' ? '・運用容量は未公表' : c.capacity ? '・' + part('運用容量', c.capacity) : ''}`;
}
