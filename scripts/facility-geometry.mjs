// WGS84 point-in-ring for local facility footprints. Boundary points count as inside.
export function inRing(point, ring) {
  if (ring.length < 4 || ring[0].lat !== ring.at(-1).lat || ring[0].lon !== ring.at(-1).lon) return false;
  const [y,x] = point; let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[j],b=ring[i];
    const cross=(x-a.lon)*(b.lat-a.lat)-(y-a.lat)*(b.lon-a.lon);
    if (Math.abs(cross)<1e-12 && x>=Math.min(a.lon,b.lon) && x<=Math.max(a.lon,b.lon) && y>=Math.min(a.lat,b.lat) && y<=Math.max(a.lat,b.lat)) return true;
    if ((a.lat>y)!==(b.lat>y) && x<(b.lon-a.lon)*(y-a.lat)/(b.lat-a.lat)+a.lon) inside=!inside;
  }
  return inside;
}
export function inFacility(point, element) {
  if (element.type === 'way') return inRing(point,element.geometry??[]);
  // Only closed rings are usable. Unassembled multipolygon fragments are not inferred.
  if (element.type === 'relation') return (element.members??[]).some(m=>m.role!=='inner' && inRing(point,m.geometry??[])) && !(element.members??[]).some(m=>m.role==='inner' && inRing(point,m.geometry??[]));
  return element.lat === point[0] && element.lon === point[1];
}
