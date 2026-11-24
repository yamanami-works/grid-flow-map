// 作業用スクリプト共通のOSM幾何処理（analyze-*/adopt-* で重複していたもの）。座標は [lat, lon]、距離はメートル。
export const d = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180)) * 111000;
export const ringOf = e => e.type === 'node' ? [[e.lat, e.lon]] : e.geometry ? e.geometry.map(g => [g.lat, g.lon]) : (e.members ?? []).filter(m => m.geometry).flatMap(m => m.geometry.map(g => [g.lat, g.lon]));
export const centroid = e => { const r = ringOf(e); return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };
export const inside = (p, pg) => { let c = false; for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) { const [yi, xi] = pg[i], [yj, xj] = pg[j]; if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
export const joinRings = parts => { const rings = [], open = parts.map(p => p.slice()); while (open.length) { let ring = open.shift(), grown = true; while (grown && !(ring.length > 3 && ring[0].join() === ring.at(-1).join())) { grown = false; for (let i = 0; i < open.length; i++) { const p = open[i]; if (p[0].join() === ring.at(-1).join()) ring = ring.concat(p.slice(1)); else if (p.at(-1).join() === ring.at(-1).join()) ring = ring.concat(p.slice(0, -1).reverse()); else continue; open.splice(i, 1); grown = true; break; } } rings.push(ring); } return rings; };
export const circle = (lat, lon, m) => Array.from({ length: 17 }, (_, k) => [lat + m / 111000 * Math.cos(k / 16 * 2 * Math.PI), lon + m / (111000 * Math.cos(lat * Math.PI / 180)) * Math.sin(k / 16 * 2 * Math.PI)]);
export const kvs = e => String(e.tags.voltage ?? '').split(';').map(v => Math.round(+v / 1000)).filter(v => v >= 10);
export const cleanName = n => n.replace(/\s*[（(][A-Za-zĀ-ſ\s.'-]+[)）]\s*$/, '').trim();
/** 探索した経路（nodes/coordinates/segments）を OSM way ごとの paths/osmIds に分ける。cable の way は cables に入る。 */
export function splitPathBy(wayById) {
  return function splitPath(p) {
    const paths = [], osmIds = [], cables = new Set(); let k = 0;
    for (const s of p.segments) { const w = wayById.get(s.way); const seg = [p.coordinates[k]]; let len = 0;
      while (k < p.coordinates.length - 1 && len < s.len - 0.5) { len += d(p.coordinates[k], p.coordinates[k + 1]); k++; seg.push(p.coordinates[k]); }
      if (seg.length > 1) { paths.push(seg); osmIds.push(s.way); if (w?.tags.power === 'cable') cables.add(s.way); } }
    return { paths, osmIds, cables: [...cables] };
  }
}
