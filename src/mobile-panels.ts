// 携帯の「選択」（☷ のパネル）と「設備を探す」のパネルを、外側のタップで閉じる（2026-11-22）。
// 潮流（凡例・時刻パネル）も外側のタップで閉じる（2026-11-22。以前の「潮流は閉じない」を変更）。開いたダイアログ（ⓘ で開くものなど）の中のタップでは閉じない。ⓘ ボタン自体は外側として扱う。
// 地図のドラッグ・ピンチの始まりで閉じないよう、指を置いてから離すまでの移動量と時間で「タップ」と判定する。
export const TAP_MAX_MOVE_PX = 10, TAP_MAX_MS = 600;
export function isTap(dx: number, dy: number, ms: number): boolean { return Math.hypot(dx, dy) <= TAP_MAX_MOVE_PX && ms <= TAP_MAX_MS; }
// この中のタップでは、どのパネルも閉じない
export const KEEP_OPEN_SELECTOR = 'dialog[open],#detail';
export type MobilePanel = { isOpen: () => boolean; inside: string; close: () => void };
export function bindOutsideTapClose(panels: MobilePanel[], enabled: () => boolean): void {
  let start: { id: number; x: number; y: number; t: number } | null = null;
  document.addEventListener('pointerdown', e => { start = enabled() && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null; }, { capture: true, passive: true });
  document.addEventListener('pointercancel', () => { start = null; }, { capture: true, passive: true });
  document.addEventListener('pointerup', e => {
    const s = start; start = null;
    if (!s || s.id !== e.pointerId || !enabled() || !isTap(e.clientX - s.x, e.clientY - s.y, performance.now() - s.t)) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest(KEEP_OPEN_SELECTOR)) return;
    for (const p of panels) if (p.isOpen() && !target.closest(p.inside)) p.close();
  }, { capture: true, passive: true });
}
