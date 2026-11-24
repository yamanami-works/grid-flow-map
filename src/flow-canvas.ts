// 潮流の粒子を1枚のキャンバスにまとめて描く（2026-10-05）。
// 以前は粒子1本ごとにSVGの線を作り、CSSで破線をずらすアニメーション（全国で約400本）にしていたため、毎フレーム全体を描き直していた。
// 見た目は同じ（破線 2・19px、1.2秒で42pxずれる、丸い端、容量不明は濃い縁）。地図の移動・拡大縮小中と、タブが裏にあるときは止める。
import L from 'leaflet';
// blink：運用容量の100%超（2026-10-10）。色に加えて太さと点滅でも区別する（動きを減らす設定では点滅しない）
// still：潮流0MW（OCCTOの原本が「0」）。流れがないので粒子を動かさない（2026-10-10）
export type Particle = { latlngs: [number, number][]; color: string; weight: number; edge?: { color: string; weight: number }; blink?: boolean; still?: boolean };
const DASH = [2, 19], PERIOD = 21, SPEED = 42 / 1.2; // px/秒（CSS の stroke-dashoffset:-42 を 1.2秒）
// 描き直しは毎秒20回まで（2026-10-10 表示速度の改善。動く速さは時刻から計算するので見た目の速さは同じ）。動く粒子・点滅がなければ1回描いたら止める
const FRAME_MS = 50;
export class FlowParticles extends L.Layer {
  private items: Particle[] = [];
  private projected: { pts: L.Point[]; p: Particle }[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0; private moving = false; private start = performance.now(); private last = 0;
  private readonly slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onAdd(map: L.Map) {
    const pane = map.getPane('flowParticles') ?? map.createPane('flowParticles');
    pane.style.zIndex = '420'; pane.style.pointerEvents = 'none';
    this.canvas = L.DomUtil.create('canvas', 'flow-particles-canvas', pane); this.ctx = this.canvas.getContext('2d');
    map.on('movestart zoomstart', this.pause, this).on('moveend zoomend resize viewreset', this.reset, this);
    document.addEventListener('visibilitychange', this.visibility);
    this.reset(); return this;
  }
  onRemove(map: L.Map) {
    cancelAnimationFrame(this.raf); this.raf = 0; this.canvas?.remove(); this.canvas = null; this.ctx = null;
    map.off('movestart zoomstart', this.pause, this).off('moveend zoomend resize viewreset', this.reset, this);
    document.removeEventListener('visibilitychange', this.visibility);
    return this;
  }
  /** 粒子を入れ替える（描き直しは次のフレーム） */
  setParticles(items: Particle[]) { this.items = items; if (this._map) this.reset(); }
  private visibility = () => { if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; } else this.loop(); };
  private pause() { this.moving = true; if (this.canvas) this.canvas.style.visibility = 'hidden'; }
  private reset() {
    const map = this._map, c = this.canvas; if (!map || !c) return;
    this.moving = false;
    const size = map.getSize(), topLeft = map.containerPointToLayerPoint([0, 0]), dpr = Math.min(window.devicePixelRatio || 1, 2);
    L.DomUtil.setPosition(c, topLeft);
    c.width = Math.round(size.x * dpr); c.height = Math.round(size.y * dpr); c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view = L.bounds([-50, -50], [size.x + 50, size.y + 50]);
    // 画面の範囲に入るものだけを画面の座標に直す
    this.projected = this.items.map(p => ({ p, pts: p.latlngs.map(ll => map.latLngToLayerPoint(ll).subtract(topLeft)) })).filter(x => x.pts.length > 1 && view.intersects(L.bounds(x.pts)));
    c.style.visibility = 'visible';
    this.draw(performance.now()); this.loop();
  }
  private loop() { if (this.raf || document.hidden || !this.canvas) return; const step = (t: number) => { this.raf = 0; if (!this.canvas || document.hidden) return; if (!this.moving && t - this.last >= FRAME_MS) this.draw(t); if (this.projected.some(x => !x.p.still || x.p.blink)) this.raf = requestAnimationFrame(step); }; this.raf = requestAnimationFrame(step); }
  private draw(t: number) {
    const ctx = this.ctx, c = this.canvas; if (!ctx || !c) return; this.last = t;
    ctx.clearRect(0, 0, c.width, c.height);
    const offset = -((t - this.start) / 1000 * SPEED / (this.slow ? 3.3 : 1)) % PERIOD;
    ctx.setLineDash(DASH); ctx.lineDashOffset = offset; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (pts: L.Point[], color: string, width: number) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
    const pulse = this.slow ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((t - this.start) / 1000 * Math.PI * 2 / 0.8));
    for (const { p, pts } of this.projected) if (p.edge) { ctx.globalAlpha = p.blink ? pulse : 1; ctx.lineDashOffset = p.still ? 0 : offset; stroke(pts, p.edge.color, p.edge.weight); }
    for (const { p, pts } of this.projected) { ctx.globalAlpha = p.blink ? pulse : 1; ctx.lineDashOffset = p.still ? 0 : offset; stroke(pts, p.color, p.weight); }
    ctx.globalAlpha = 1;
  }
}
