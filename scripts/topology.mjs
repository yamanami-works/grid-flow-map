// Shared OSM node IDs are evidence of mapped connectivity. Proximity is not.
export function components(ways) {
  const owners = new Map(), parent = ways.map((_, i) => i);
  const root = i => parent[i] === i ? i : (parent[i] = root(parent[i]));
  ways.forEach((way, i) => {
    for (const node of way.nodes ?? []) {
      if (owners.has(node)) parent[root(i)] = root(owners.get(node));
      else owners.set(node, i);
    }
  });
  const groups = new Map();
  ways.forEach((w, i) => { const key = root(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(w); });
  return [...groups.values()];
}
export function terminals(ways) {
  const degrees = new Map(), positions = new Map();
  for (const w of ways) {
    w.nodes.forEach((id, i) => {
      positions.set(id, [w.geometry[i].lat, w.geometry[i].lon]);
      if (i > 0) {
        degrees.set(id, (degrees.get(id) ?? 0) + 1);
        const previous = w.nodes[i - 1];
        degrees.set(previous, (degrees.get(previous) ?? 0) + 1);
      }
    });
  }
  return [...degrees].filter(([, degree]) => degree === 1).map(([node]) => ({node, position: positions.get(node)}));
}
export function distanceMeters(a, b) {
  const rad = Math.PI / 180, p = (b[0] - a[0]) * rad, q = (b[1] - a[1]) * rad;
  const h = Math.sin(p / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(q / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function traceToFacilities(seedIds, ways, nodes, isFacilityNode) {
  const visited=new Set(seedIds),queue=[...visited];
  for(let i=0;i<queue.length;i++) {
    const way=ways.get(queue[i]);
    for(let index=0;index<way.nodes.length;index++) {
      const node=way.nodes[index];
      if(nodes.get(node).size<2 || isFacilityNode(node,way.geometry[index])) continue;
      for(const next of nodes.get(node)) if(!visited.has(next)) {visited.add(next);queue.push(next);}
    }
  }
  return [...visited];
}
