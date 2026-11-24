// 詳細パネル（2026-10-09 の再設計、仕様 docs/mockups/detail-panel/README.md）。
// ここは表示だけを持つ。データの組み立て（どの公表値を使うか）は real.ts の lineView / facilityView / occtoOnlyView。
// 共通ルール：注意書きは「注意 n件」に集約、確度は A〜E、不明値は灰色「未確認」（0や仮の値で埋めない）、本文15px・補足13px、タップ領域44px以上。
import {escapeHtml as esc, externalLink} from './safe-html.ts';

export type Tone = 'ok' | 'muted' | 'retired' | 'warn' | 'plain';
export type Badge = {text: string; tone: Tone};
// HTML として受け取る値（Row の label・html、DetailView の overview・verification）は、呼び出し側（real.ts）でデータの値を esc 済みの HTML にして渡す約束（2026-11-02）
export type Row = {label: string; html: string};
export type SourceItem = {label: string; name: string; date?: string; url?: string};
export type FlowCard = {
  mw: number | null; from: string; to: string; time: string;
  usage: number | null; usageColor: string; capacityMW: number | null;
  /** 分岐をはさむOCCTOの行：分岐する線の名前。使用率は行単位の値（区間ごとの値ではない）と注記する（2026-10-10） */
  reference?: string[];
  /** 逆潮流：公表の正方向の運用容量で算出した参考の使用率（2026-10-10） */
  reverse?: boolean;
  // 運用容量の状態（2026-10-10）：zero＝0MWで公表（表示は「未確認 運用容量 0 MW」＋注意。2026-11-04）、negative＝負の値で公表（使用率は絶対値で算出。2026-11-04）、none＝なし・設定なし（99999等）
  capacityState?: 'ok' | 'zero' | 'negative' | 'none';
  // 2026-10-10：combined＝OCCTOの1行を複数の線に出している（線名の一覧）、workCapacity＝作業時の運用容量（制約要因）、
  //   timedCapacity＝時刻別（30分値）の運用容量で算出（連系線）、capacityExcluded＝分母に使わない容量の行の理由
  combined?: string[]; workCapacity?: string; timedCapacity?: boolean; capacityExcluded?: string;
  /** その日の後の取得で OCCTO が運用容量を未公表だったため残した値の取得時刻（2026-10-30） */
  capacityRetrievedAt?: string;
  /** OCCTO公表値の符号を、当サイトが日ごとの判定で反転して表示している（北陸 敦賀火力線。src/hokuriku-domain.ts の SIGN_CHECKS。2026-11-04） */
  signFlipped?: boolean;
  spark: (number | null)[]; sparkIndex: number;
};
export type ConnectedLine = {id: string; name: string; color: string; sub: string; mw: number | null; side: '流入' | '流出' | null; usage: number | null; usageColor: string; caution: boolean; inferred: boolean};
export type DetailView = {
  icon: 'line' | 'substation' | 'switchyard' | 'converter' | 'plant' | 'customer' | 'occto';
  iconColor: string; title: string; subtitle: string; badges: Badge[];
  banner?: {title?: string; text: string; tone: 'muted' | 'retired'};
  // loading：過去日の潮流を読み込み中（前の日の値を出さない。2026-10-10）
  flow?: FlowCard | 'none' | 'loading' | 'excluded';
  overview: string; tier: {letter: string; title: string; text: string; scale: {letter: string; label: string}[]};
  sources: SourceItem[]; notes: string[]; verification: string;
};

export const UNKNOWN = '<span class="dp-unknown">未確認</span>';
const num = (n: number) => n.toLocaleString('ja-JP');
// 取得時刻（ISO）を「M/D HH:MM JST」に。読めない値はそのまま出す
const jstText = (iso: string) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return iso; const p = Object.fromEntries(new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(t).map(x => [x.type, x.value])); return `${p.month}/${p.day} ${p.hour}:${p.minute} JST`; };
const ICON: Record<DetailView['icon'], string> = {
  line: '<path d="M3 20 L21 4"/><path d="M7 20 L5 14 M17 4 L19 10"/>',
  occto: '<path d="M3 20 L21 4" stroke-dasharray="3 3"/>',
  substation: '<rect x="4" y="5" width="16" height="14"/><path d="M9.3 5v14M14.7 5v14"/>',
  switchyard: '<path d="M12 3 21 12 12 21 3 12Z"/>',
  customer: '<path d="M7.5 4.2h9l4.5 7.8-4.5 7.8h-9L3 12Z"/>',
  converter: '<rect x="4" y="4" width="16" height="16"/><path d="M6 18 18 6"/>',
  plant: '<circle cx="12" cy="12" r="8"/><path d="M13 6.5 9.5 12.5h3l-1 5 3.5-6h-3z"/>',
};

/** 注意を重複なく並べる（同じ文を2回出さない） */
export function uniqueNotes(notes: (string | null | undefined | false)[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const n of notes) { if (!n) continue; const t = n.trim(); const k = t.replace(/\s/g, ''); if (!t || seen.has(k)) continue; seen.add(k); out.push(t); }
  return out;
}
/** 注意ボタンの1行要約：「注意 2件 · 最初の注意 ほか」 */
export function notesSummary(notes: string[]): string {
  if (!notes.length) return '';
  const first = notes[0].replace(/[。．]$/, ''), short = first.length > 22 ? first.slice(0, 21) + '…' : first;
  return `注意 ${notes.length}件 · ${short}${notes.length > 1 ? ' ほか' : ''}`;
}
/** 公表区間の正方向と潮流の符号から、設備にとっての流入/流出を決める。設備が区間のどちらの端か分からなければ null */
export function flowSide(value: number | null, facilityIsFrom: boolean | null): '流入' | '流出' | null {
  if (value === null || value === 0 || facilityIsFrom === null) return null;
  const leavesFrom = value > 0; // 正の値は from → to
  return facilityIsFrom === leavesFrom ? '流出' : '流入';
}

function sparkSvg(values: (number | null)[], index: number) {
  if (!values.some(v => v !== null)) return '';
  const max = Math.max(1, ...values.filter((v): v is number => v !== null).map(Math.abs));
  const x = (i: number) => 2 + i / Math.max(1, values.length - 1) * 314, y = (v: number) => 22 - v / max * 18;
  let d = '', on = false;
  values.forEach((v, i) => { if (v === null) { on = false; return; } d += `${on ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; on = true; });
  const cur = values[index];
  return `<svg class="dp-spark" viewBox="0 0 318 44" role="img" aria-label="当日の潮流の推移（最大 ${num(max)} MW、欠測は空白）"><path d="M0 22H318" stroke="#E3E8EA" stroke-dasharray="3 3"/><path d="${d}" fill="none" stroke="#2E6F86" stroke-width="2"/>${cur != null ? `<circle cx="${x(index).toFixed(1)}" cy="${y(cur).toFixed(1)}" r="4" fill="#D99A29"/>` : ''}</svg>`;
}
export function flowCardHtml(f: FlowCard | 'none' | 'loading' | 'excluded'): string {
  // 需要家線（OCCTOに行がない区間）：潮流は公表の対象外。「未確認」（公表はあるが未収録）とは別の表示（2026-10-11）
  if (f === 'excluded') return `<div class="dp-flow dp-flow-none dp-flow-excluded"><div class="dp-flow-head"><span>潮流 実績</span></div><p><span class="dp-excluded">潮流公表対象外</span><span class="dp-sub">　需要家に供給する区間で、OCCTOの潮流の公表対象ではありません。</span></p></div>`;
  if (f === 'loading') return `<div class="dp-flow dp-flow-none"><div class="dp-flow-head"><span>潮流 実績</span></div><p><span class="dp-unknown">読み込み中</span><span class="dp-sub">　この日の潮流データを読み込んでいます</span></p></div>`;
  if (f === 'none') return `<div class="dp-flow dp-flow-none"><div class="dp-flow-head"><span>潮流 実績</span></div><p>${UNKNOWN}<span class="dp-sub">　この線に対応するOCCTOの潮流は未収録です。</span></p></div>`;
  const arrow = '<svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 6H20M15 1l5 5-5 5"/></svg>';
  const value = f.mw === null ? `<span class="dp-flow-mw">${UNKNOWN}</span>` : `<span class="dp-flow-mw"><b>${num(Math.abs(f.mw))}</b> MW</span>`;
  const dir = f.mw === null || f.mw === 0 ? '' : `<span class="dp-flow-dir">${esc(f.mw < 0 ? f.to : f.from)} ${arrow} ${esc(f.mw < 0 ? f.from : f.to)}</span>`;
  const pct = f.usage === null ? null : Math.min(100, f.usage);
  const bar = `<div class="dp-bar" role="img" aria-label="${f.usage === null ? '使用率 未確認' : '使用率 ' + f.usage.toFixed(0) + '%'}">${pct === null ? '' : `<i style="width:${pct}%;background:${f.usageColor}"></i>`}<b style="left:50%"></b><b style="left:80%"></b></div>`;
  // 使用率の行は「主の表示＋運用容量 ○ MW 比」の1形式（2026-11-03）。説明はⓘ、その線だけの事情は注意（flowCardNotes）に出す
  const usage = f.usage === null && f.capacityState === 'zero' ? `<span><span class="dp-unknown">未確認</span><span class="dp-sub"> 運用容量 0 MW</span></span>` : f.usage === null ? `<span>${UNKNOWN}</span>` : `<span><b style="color:${f.usageColor === '#fff' || f.usageColor === '#ffffff' ? '#1B2328' : f.usageColor}">${f.usage.toFixed(0)}%</b>${f.usage > 100 ? '<span class="dp-over">運用容量超過</span>' : ''}<span class="dp-sub"> 運用容量 ${f.capacityMW === null ? '—' : num(f.capacityMW) + ' MW'} 比</span></span>`;
  return `<div class="dp-flow"><div class="dp-flow-head"><span>潮流 実績</span><span>${esc(f.time)}</span></div><div class="dp-flow-main">${value}${dir}</div>${f.signFlipped ? '<p class="dp-sub dp-flow-flip">向きはOCCTO公表値から反転（当サイトの判定）</p>' : ''}${bar}<div class="dp-flow-foot">${usage}</div>${sparkSvg(f.spark, f.sparkIndex)}</div>`;
}
/** 潮流の欄から出した、その線だけの事情（注意に入れる。esc しない素の文。表示側でエスケープする）。2026-11-03 */
export function flowCardNotes(f: FlowCard | 'none' | 'loading' | 'excluded' | undefined): string[] {
  if (!f || typeof f === 'string') return [];
  return [
    f.reference ? `OCCTO公表の行単位の値（区間ごとの値ではない）。分岐（${f.reference.join('・')}）をはさむ1行（${f.from}→${f.to}）の値で、行の区間全体を同じ使用率で表示します。` : null,
    f.combined ? `OCCTO公表の${f.combined.length}線合計の値（${f.combined.join('・')}）。各線に同じ合計値を表示しています。` : null,
    f.reverse ? '逆潮流のため、正方向の運用容量で使用率を算出しています（OCCTOは公表上の正方向の運用容量だけを公表）。' : null,
    f.workCapacity ? `作業時の運用容量（制約要因：${f.workCapacity}）。OCCTOは1日1つの値を公表するため、作業時間外も同じ値で算出しています。` : null,
    f.timedCapacity ? '運用容量は時刻別（30分値＝OCCTOの5分値6つの平均）。' : null,
    f.capacityExcluded ? `${f.capacityExcluded}。` : null,
    f.capacityRetrievedAt ? `運用容量は ${jstText(f.capacityRetrievedAt)} 取得の値（その後の取得では OCCTO が未公表）。` : null,
    f.mw === 0 ? '0 MW（OCCTOの公表値が「0」。空欄＝欠測とは別）' : null,
    f.capacityState === 'zero' ? '運用容量 0 MW で公表（停止中の可能性）。使用率は未確認です。' : null,
    f.usage !== null && f.capacityState === 'negative' && f.capacityMW !== null ? `運用容量が負の値（${num(f.capacityMW)} MW）で公表。符号の意味は OCCTO の項目説明に記載がないため、絶対値（${num(Math.abs(f.capacityMW))} MW）で算出した参考値です（当サイトの判断。向きの対応も未確認）。` : null,
  ].filter((n): n is string => !!n);
}
export function rowsHtml(rows: Row[]): string {
  return `<dl class="dp-rows">${rows.map(r => `<dt>${r.label}</dt><dd>${r.html}</dd>`).join('')}</dl>`;
}
export function connectedLinesHtml(lines: ConnectedLine[], time: string): string {
  if (!lines.length) return `<div class="dp-section-head"><b>接続する送電線</b></div><p class="dp-sub">地図上でこの設備に端が届く送電線はありません。</p>`;
  return `<div class="dp-section-head"><b>接続する送電線 ${lines.length}本</b>${time ? `<span class="dp-sub">${esc(time)}</span>` : ''}</div>${lines.map(l => `<button type="button" class="dp-cline" data-goto-line="${esc(l.id)}"><i style="background:${l.color}"></i><span class="dp-cline-main"><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span><span class="dp-cline-value">${l.inferred ? '<span class="dp-badge dp-warn">推測</span>' : l.mw === null ? '<small>潮流<br>未収録</small>' : `<b>${num(Math.abs(l.mw))}</b> MW${l.side ? ' ' + l.side : ''}${l.usage === null ? '' : `<small style="color:${l.usageColor === '#fff' ? '#4F5B63' : l.usageColor}">${l.usage.toFixed(0)}%</small>`}`}</span><span class="dp-chev" aria-hidden="true">›</span></button>`).join('')}`;
}
export function notesButtonHtml(notes: string[]): string {
  if (!notes.length) return '';
  return `<button type="button" class="dp-notes-button" data-dp-notes aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A5A08" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.1"/></svg><span>${esc(notesSummary(notes))}</span><span aria-hidden="true">›</span></button><ol class="dp-notes-list" hidden>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ol>`;
}
const TONE_CLASS: Record<Tone, string> = {ok: 'dp-ok', muted: 'dp-muted', retired: 'dp-retired', warn: 'dp-warn', plain: 'dp-muted'};
export function badgeHtml(b: Badge) { return `<span class="dp-badge ${TONE_CLASS[b.tone]}">${esc(b.text)}</span>`; }

/** パネル全体。tab は 'overview' | 'sources' */
export function detailHtml(v: DetailView, tab: 'overview' | 'sources'): string {
  const head = `<div class="dp-handle" aria-hidden="true"></div><div class="dp-head"><div class="dp-icon" style="background:${v.iconColor}1f;color:${v.iconColor}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[v.icon]}</svg></div><div class="dp-title"><h2>${esc(v.title)}</h2><p>${esc(v.subtitle)}</p></div><button id="real-detail-close" class="dp-close" aria-label="詳細を閉じる"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="dp-badges">${v.badges.map(badgeHtml).join('')}</div>${v.banner ? `<div class="dp-banner ${v.banner.tone === 'retired' ? 'dp-banner-retired' : ''}">${v.banner.title ? `<b>${esc(v.banner.title)}</b>` : ''}${esc(v.banner.text)}</div>` : ''}${v.flow ? flowCardHtml(v.flow) : ''}`;
  const tabs = `<div class="dp-tabs" role="tablist">${(['overview', 'sources'] as const).map(t => `<button type="button" role="tab" id="dp-tab-${t}" aria-controls="dp-panel" aria-selected="${t === tab}" data-dp-tab="${t}">${t === 'overview' ? '概要' : '出典'}</button>`).join('')}</div>`;
  const body = tab === 'overview' ? v.overview : sourcesHtml(v);
  return `${head}${tabs}<div id="dp-panel" role="tabpanel" aria-labelledby="dp-tab-${tab}">${body}</div>`;
}
function sourcesHtml(v: DetailView): string {
  const t = v.tier;
  const tier = `<div class="dp-tier"><div class="dp-tier-letter${t.letter === '—' ? ' dp-tier-none' : ''}">${esc(t.letter)}</div><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div></div><div class="dp-tier-scale">${t.scale.map(s => `<span class="${s.letter === t.letter ? 'dp-tier-on' : ''}">${esc(s.letter)} ${esc(s.label)}</span>`).join('')}</div>`;
  const items = `<h3 class="dp-h3">項目ごとの出典</h3><div class="dp-sources">${v.sources.map(s => `<div class="dp-source"><span class="dp-source-label">${esc(s.label)}</span><span class="dp-source-name">${esc(s.name)}${s.date ? ` <span class="dp-sub">${esc(s.date)}</span>` : ''}</span>${s.url ? externalLink(s.url, '').trim().replace('<a ', '<a class="dp-source-link" aria-label="' + esc(s.label) + 'の出典を開く" ') : '<span></span>'}</div>`).join('')}</div>`;
  const notes = v.notes.length ? `<h3 class="dp-h3">注意 ${v.notes.length}件</h3><ol class="dp-notes-full">${v.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : '<h3 class="dp-h3">注意</h3><p class="dp-sub">ありません。</p>';
  const verification = v.verification ? `<details class="dp-verify"><summary>照合の詳細<span aria-hidden="true">›</span></summary><div class="dp-verify-body">${v.verification}</div></details>` : '';
  return tier + items + notes + verification;
}
