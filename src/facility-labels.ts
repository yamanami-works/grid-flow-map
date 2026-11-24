// 地図の設備名のラベル（2026-11-22 指示。回答「後ろにつく変電所や発電所などの共通の言葉は記載せずに、頭の名前だけ表示するようにして。あとは推奨で」）。
// - ズーム10以上で、画面内の設備の名前を地図に出す（ズーム9以下と宮城の試行画面では出さない）。
// - 名前は末尾の種類の語（変電所・開閉所・変換所・連系所・発電所、発電所の前の火力・水力などの発電方式）を除いた頭の名前。詳細パネル・ツールチップの名前は元のまま。
// - 文字同士・印・地図のボタンなどと重ならない位置（印の右→左→上→下）にだけ置く。置けない名前は出さない（拡大すると出る）。
// - 重なったときに優先：選択中＞変換所＞電圧の高い順＞発電所・需要家。同じなら名前・id の順（毎回同じ結果）。
// - 文字は 12px 太字・濃い緑灰色・白い縁取り（facility-symbol.css の .facility-label）。タップ・クリックは受けない（pointer-events:none、aria-hidden）。
import type L from 'leaflet';

export const LABEL_MIN_ZOOM = 10, LABEL_FONT = '600 12px system-ui, sans-serif', LABEL_HEIGHT = 16, LABEL_GAP = 3, LABEL_PAD = 4, MARKER_SIZE = 22;
// 発電方式の語は「発電所」の前だけ除く（「西条火力変電所」は「西条火力」）
const KIND_WORDS = '(?:(?:火力|水力|原子力|太陽光|風力|地熱|バイオマス|揚水)?発電所|変電所|開閉所|変換所|連系所)';
const SUFFIX = new RegExp(`^(.+?)${KIND_WORDS}(（[^（）]*）)?$`);
// 発電方式の語を残す形（発電所どうしで同じ名前になるとき。2026-11-22 回答「いずれも推奨で」：敦賀火力・敦賀原子力など）
const SUFFIX_KEEP_METHOD = /^(.+?)(?:発電所|変電所|開閉所|変換所|連系所)(（[^（）]*）)?$/;
/** 地図のラベルの名前：末尾の種類の語を除いた頭の名前。除くと空になる・「の」で終わる（「〜発電所の開閉所」など）ときは元の名前 */
export function labelName(name: string, keepMethod = false): string {
  const m = (keepMethod ? SUFFIX_KEEP_METHOD : SUFFIX).exec(name);
  if (!m || /の$/.test(m[1])) return name;
  return m[1] + (m[2] ?? '');
}

/** 設備ごとのラベルの名前。発電所どうしで頭の名前が同じになるときは、その発電所だけ発電方式の語を残す（変電所と発電所の組は印の形で区別できるのでそのまま） */
export function labelNames(all: {id: string; name: string; kind: string}[]): Map<string, string> {
  const out = new Map<string, string>(), plants = new Map<string, Set<string>>();
  for (const f of all) { const n = labelName(f.name); out.set(f.id, n); if (f.kind === 'plant') { const g = plants.get(n) ?? new Set<string>(); g.add(f.name); plants.set(n, g); } }
  for (const f of all) if (f.kind === 'plant' && (plants.get(out.get(f.id)!)?.size ?? 0) > 1) out.set(f.id, labelName(f.name, true));
  return out;
}

export type Box = { l: number; t: number; r: number; b: number };
export type LabelInput = { id: string; text: string; x: number; y: number; markerWidth: number; priority: number };
export type PlacedLabel = { id: string; text: string; x: number; y: number; width: number };
const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** 出す順：優先度の小さい順、同じなら名前・id の順 */
export function labelOrder(items: LabelInput[]): LabelInput[] {
  return [...items].sort((a, b) => a.priority - b.priority || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/**
 * 重ならない配置（純粋な関数）。x・y は印の中心（画面上の位置）、width は文字の幅を返す関数。
 * 画面（view）の外・除く範囲（blocked）・すべての印・置いたラベルと重なる位置には置かない。
 */
export function placeLabels(items: LabelInput[], width: (text: string) => number, view: Box, blocked: Box[] = []): PlacedLabel[] {
  const markers: Box[] = items.map(i => ({ l: i.x - i.markerWidth / 2, t: i.y - MARKER_SIZE / 2, r: i.x + i.markerWidth / 2, b: i.y + MARKER_SIZE / 2 }));
  const taken: Box[] = [], out: PlacedLabel[] = [];
  for (const i of labelOrder(items)) {
    if (i.x < view.l || i.x > view.r || i.y < view.t || i.y > view.b) continue;
    const w = width(i.text) + LABEL_PAD, h = LABEL_HEIGHT, half = i.markerWidth / 2, top = i.y - h / 2;
    const candidates: [number, number][] = [[i.x + half + LABEL_GAP, top], [i.x - half - LABEL_GAP - w, top], [i.x - w / 2, i.y - MARKER_SIZE / 2 - LABEL_GAP - h], [i.x - w / 2, i.y + MARKER_SIZE / 2 + LABEL_GAP]];
    for (const [l, t] of candidates) {
      const box = { l, t, r: l + w, b: t + h };
      if (box.l < view.l || box.r > view.r || box.t < view.t || box.b > view.b) continue;
      if (blocked.some(o => hit(o, box)) || markers.some(o => hit(o, box)) || taken.some(o => hit(o, box))) continue;
      taken.push(box); out.push({ id: i.id, text: i.text, x: l, y: t, width: w }); break;
    }
  }
  return out;
}

/** 文字の幅（canvas で測り、名前ごとに覚える。レイアウトの計算を走らせない） */
const widths = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;
export function textWidth(text: string): number {
  let w = widths.get(text);
  if (w != null) return w;
  if (ctx === undefined) { ctx = document.createElement('canvas').getContext('2d'); if (ctx) ctx.font = LABEL_FONT; }
  w = ctx ? Math.ceil(ctx.measureText(text).width) : text.length * 12;
  widths.set(text, w);
  return w;
}

export type LabelFacility = { id: string; name: string; kind: string; alsoKinds?: string[]; voltages: number[]; position: [number, number]; status?: string };
/** 優先度：選択中 0、変換所 1、電圧のある変電所・開閉所など 2〜（高い電圧ほど小さい）、発電所・需要家はその後 */
export function labelPriority(f: LabelFacility, selectedId: string | null): number {
  if (f.id === selectedId) return 0;
  if (f.kind === 'converter') return 1;
  const v = Math.max(0, ...f.voltages);
  const base = f.kind === 'plant' || f.kind === 'customer' ? 3000 : 2;
  return base + (1000 - Math.min(v, 999));
}

const PANE = 'facility-labels';
/** 地図のラベルの層。ラベルは印（600）より上、ツールチップ（650）より下（610） */
export class FacilityLabels {
  // 層はズーム10以上で初めて要るときに作る（全国表示などラベルを出さない間は DOM を増やさない）
  private pane: HTMLElement | null = null;
  private els = new Map<string, HTMLElement>();
  private map: L.Map;
  private blockedSelector: string;
  private allFacilities: () => LabelFacility[];
  private namesFor: LabelFacility[] | null = null;
  private names = new Map<string, string>();
  /** allFacilities：同じ名前の発電所を見分けるための、表示している全設備（画面内に限らない） */
  constructor(map: L.Map, blockedSelector: string, allFacilities: () => LabelFacility[]) {
    this.map = map; this.blockedSelector = blockedSelector; this.allFacilities = allFacilities;
    // 拡大縮小の動きの間は隠し、置かない（終わりの zoomend・moveend で置き直す）
    map.on('zoomstart', () => { this.zooming = true; if (this.pane && this.els.size) this.pane.style.display = 'none'; });
    map.on('zoomend', () => { this.zooming = false; });
  }
  private ensurePane(): HTMLElement {
    if (!this.pane) {
      this.pane = this.map.createPane(PANE);
      this.pane.style.zIndex = '610'; this.pane.style.pointerEvents = 'none'; this.pane.setAttribute('aria-hidden', 'true');
    }
    return this.pane;
  }
  // 配置は次の描画の前に1回だけ行う（moveend と zoomend が続けて来ても1回。地図の操作の処理の中で重い計算をしない）
  private raf = 0;
  private zooming = false;
  private next: [LabelFacility[], string | null, boolean] | null = null;
  update(facilities: LabelFacility[], selectedId: string | null, enabled: boolean): void {
    this.next = [facilities, selectedId, enabled];
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; const n = this.next; this.next = null; if (n && !this.zooming) this.place(...n); });
  }
  private removeAll(): void { if (!this.els.size) return; for (const el of this.els.values()) el.remove(); this.els.clear(); }
  clear(): void { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; this.next = null; } this.removeAll(); }
  private place(facilities: LabelFacility[], selectedId: string | null, enabled: boolean): void {
    const map = this.map, size = map.getSize();
    if (!enabled || map.getZoom() < LABEL_MIN_ZOOM || size.x <= 0 || size.y <= 0) { this.removeAll(); if (this.pane && this.pane.style.display) this.pane.style.display = ''; return; }
    const pane = this.ensurePane();
    const rect = map.getContainer().getBoundingClientRect();
    const blocked: Box[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(this.blockedSelector))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) blocked.push({ l: r.left - rect.left, t: r.top - rect.top, r: r.right - rect.left, b: r.bottom - rect.top });
    }
    const all = this.allFacilities();
    if (all !== this.namesFor) { this.names = labelNames(all); this.namesFor = all; }
    const items: LabelInput[] = facilities.map(f => {
      const p = map.latLngToContainerPoint(f.position);
      return { id: f.id, text: (this.names.get(f.id) ?? labelName(f.name)) + (f.status === '廃止' ? '（廃止）' : ''), x: p.x, y: p.y, markerWidth: MARKER_SIZE * (1 + (f.alsoKinds?.length ?? 0)), priority: labelPriority(f, selectedId) };
    });
    const placed = placeLabels(items, textWidth, { l: 0, t: 0, r: size.x, b: size.y }, blocked);
    const keep = new Set<string>();
    for (const p of placed) {
      keep.add(p.id);
      let el = this.els.get(p.id);
      if (!el) { el = document.createElement('div'); el.className = 'facility-label'; pane.appendChild(el); this.els.set(p.id, el); }
      if (el.textContent !== p.text) el.textContent = p.text;
      const lp = map.containerPointToLayerPoint([p.x, p.y]); el.style.transform = 'translate3d(' + lp.x + 'px,' + lp.y + 'px,0)';
    }
    for (const [id, el] of this.els) if (!keep.has(id)) { el.remove(); this.els.delete(id); }
    if (pane.style.display) pane.style.display = '';
  }
}
