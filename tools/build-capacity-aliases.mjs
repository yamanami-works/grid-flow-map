// OCCTO の運用容量の表と実績の行で、線名・端点の書き方だけが違うものの対応表（2026-10-10 オーナー承認）→ src/capacity-aliases.ts。
// 当てるもの：四国「○○変電所」⇔実績「○○SS」、関西「A⇒B」の1欄形式、全角・半角や「（変）」の違い（名前・電圧が同じで、端点の語幹が一致するものだけ）。
// 「（他社）」の行は意味が確認できるまで全エリアで分母に使わない（2026-10-10 オーナー指示）。対応表に入れず、alignCapacities で excluded を付ける。
// 当てないもの：「フェンス」付きの行（九州「（フェンス１）」、中国「（フェンス管理箇所）」。ループ系統の複数線の合計で管理する断面で、1本の線の容量ではない
//   — OCCTO「運用容量等に関する基本的事項について」2024-07-19 第1回将来の運用容量等の在り方に関する作業会 資料6 p.11）、
//   運用容量 99999 以上（設定なしを表す値）、端点の語幹が違う行（区間が違う可能性。一次資料で確かめてから）。
// 各エリアの reviewed*Day が最初に alignCapacities で容量の行を実績の書き方へそろえてから照合する。
import fs from 'node:fs';
import path from 'node:path';
import {reviewedTohokuDay} from '../src/tohoku-domain.ts'; import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts'; import {reviewedTokyoDay} from '../src/tokyo-domain.ts';
import {reviewedChubuDay} from '../src/chubu-domain.ts'; import {reviewedHokurikuDay} from '../src/hokuriku-domain.ts'; import {reviewedKansaiDay} from '../src/kansai-domain.ts';
import {reviewedChugokuDay} from '../src/chugoku-domain.ts'; import {reviewedShikokuDay} from '../src/shikoku-domain.ts'; import {reviewedKyushuDay} from '../src/kyushu-domain.ts';
import {CAPACITY_ALIASES} from '../src/capacity-aliases.ts';
const APP = path.resolve(import.meta.dirname, '..');
// 照合（reviewed*Day）は対応表を通すので、生成のときは今の対応表を空にしてから落ちる行を数える（空にしないと自分の結果で候補が消える）
for (const k of Object.keys(CAPACITY_ALIASES)) delete CAPACITY_ALIASES[k];
const read = f => JSON.parse(fs.readFileSync(path.join(APP, 'public/data', f), 'utf8'));
// 今の照合（reviewed*Day）で落ちている容量の行だけを対象にする（すでに当たっているエリア・行の書き方は変えない）
const R = {tohoku: ['occto-tohoku.json', reviewedTohokuDay], hokkaido: ['hokkaido-flow.json', reviewedHokkaidoDay], tokyo: ['tokyo-flow.json', reviewedTokyoDay], chubu: ['chubu-flow.json', reviewedChubuDay], hokuriku: ['hokuriku-flow.json', reviewedHokurikuDay], kansai: ['kansai-flow.json', reviewedKansaiDay], chugoku: ['chugoku-flow.json', reviewedChugokuDay], shikoku: ['shikoku-flow.json', reviewedShikokuDay], kyushu: ['kyushu-flow.json', reviewedKyushuDay]};
const nameKey = s => String(s ?? '').normalize('NFKC').replace(/\s/g, '').replace(/[（(][^）)]*[）)]/g, '');
const stem = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s/g, '').replace(/(変電所|開閉所|変換所|発電所|連系所|ss|sws|s\/s|\(変\)|\(開\)|\(発\))$/, '');
const ends = c => c.to == null && /⇒/.test(c.from ?? '') ? String(c.from).split('⇒').map(s => s.trim()) : [c.from, c.to];
const out = {}, skipped = {fence: 0, other: 0, unset: 0, noRow: 0, ambiguous: 0};
for (const [region, [file, review]] of Object.entries(R)) {
  const list = new Map();
  for (const day of read(file).days) {
    const kept = new Set(review({...day}).capacities.map(c => c.id));
    for (const c of day.capacities ?? []) {
      if (kept.has(c.id)) continue; // 今の照合で当たっている
      if (/フェンス/.test(c.name)) { skipped.fence++; continue; }
      if (/他社/.test(c.name)) { skipped.other++; continue; }
      if (c.capacityMW != null && c.capacityMW >= 99999) { skipped.unset++; continue; }
      const [cf, ct] = ends(c);
      const rows = day.actual.lines.filter(r => r.voltageKV === c.voltageKV && nameKey(r.name) === nameKey(c.name) && ((stem(r.from) === stem(cf) && stem(r.to) === stem(ct)) || (stem(r.from) === stem(ct) && stem(r.to) === stem(cf))));
      const uniq = [...new Map(rows.map(r => [r.name + '|' + r.from + '|' + r.to, r])).values()];
      if (!uniq.length) { skipped.noRow++; continue; }
      if (uniq.length > 1) { skipped.ambiguous++; continue; }
      const r = uniq[0], fwd = stem(r.from) === stem(cf);
      const as = {name: r.name, from: fwd ? r.from : r.to, to: fwd ? r.to : r.from};
      if (as.name === c.name && as.from === c.from && as.to === c.to) continue; // そのままで当たる
      list.set([c.name, c.from, c.to ?? ''].join('|'), {cap: {name: c.name, from: c.from, to: c.to ?? null}, as});
    }
  }
  if (list.size) out[region] = [...list.values()];
}
const body = Object.entries(out).map(([r, l]) => `  ${r}: [\n${l.map(x => `    [${JSON.stringify(x.cap.name)}, ${JSON.stringify(x.cap.from)}, ${JSON.stringify(x.cap.to)}, ${JSON.stringify(x.as.name)}, ${JSON.stringify(x.as.from)}, ${JSON.stringify(x.as.to)}],`).join('\n')}\n  ],`).join('\n');
fs.writeFileSync(path.join(APP, 'src/capacity-aliases.ts'), `// 自動生成（tools/build-capacity-aliases.mjs、${new Date().toISOString().slice(0, 10)}）。手で編集しない。
// OCCTO の運用容量の行 [線名, 起点, 終点（「A⇒B」1欄形式は null）] を、実績の行の書き方 [線名, 起点, 終点] にそろえる対応表。
// 「フェンス」付きの行（複数線の合計の断面）、「（他社）」の行、運用容量 99999 以上（設定なし）は入れない。
export const CAPACITY_ALIASES: Record<string, [string, string, string | null, string, string, string][]> = {
${body}
};
// 分母に使わない容量の行（2026-10-10 オーナー指示）。行は残し excluded（理由）を付ける。使用率は「未確認」になる
// - 「（他社）」の行：意味が確認できるまで全エリアで使わない（新坂戸線・西南川越線・西南多摩線など）
// - 東京 港北線（港北→西東京）：潮流3,120MWが東京電力PGの設備容量（2,926〜3,066MW）も超え、潮流の行と容量の行の対応が一次資料で確認できるまで使わない
export const EXCLUDED_CAPACITIES: {region: string | null; test: (c: Cap) => boolean; why: string}[] = [
  {region: null, test: c => /他社/.test(c.name), why: '容量の行が「（他社）」の行で、意味が確認できていないため分母に使っていません'},
  {region: 'tokyo', test: c => c.name.normalize('NFKC').trim() === '港北線' && c.from === '港北' && c.to === '西東京', why: '潮流の行と容量の行の対応を一次資料で確認中のため分母に使っていません（潮流が設備容量を超える時間帯があるため）'},
];
type Cap = {name: string; from: string; to: string | null | undefined; excluded?: string};
/** 容量の行を実績の行の書き方にそろえ、分母に使わない行に excluded を付ける（各エリアの reviewed*Day の最初に通す） */
export function alignCapacities<T extends {capacities?: Cap[]}>(region: string, day: T): T {
  if (!day.capacities) return day; const list = CAPACITY_ALIASES[region] ?? [], ex = EXCLUDED_CAPACITIES.filter(e => e.region === null || e.region === region);
  return {...day, capacities: day.capacities.map(c => { const e = ex.find(e => e.test(c)); const a = list.find(x => x[0] === c.name && x[1] === c.from && x[2] === (c.to ?? null)); const r = a ? {...c, name: a[3], from: a[4], to: a[5]} : c; return e ? {...r, excluded: e.why} : r; })};
}
`);
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), skipped);
