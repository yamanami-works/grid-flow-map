// Display capabilities are not entitlements or server authorization.
export type CurrentType='ac'|'dc'|'unknown';
export type ElectricalDisplay={voltageKV:number;currentType?:string};
export const trunkDisplay={
 region:'TOHOKU NETWORK',regionLabel:'東北エリア',rangeLabel:'500/275kV・DC',targetLabel:'500 / 275 kV・直流',
 acVoltages:[500,275],facilityKinds:['substation','switchyard','plant','converter','customer'],
 capabilities:{capacityOverlay:false,flow:true},
 areaLabel:'東北・新潟＋北海道連系DC',
 coverage:'東北6県・新潟の500/275 kVと接続線、北海道―本州間直流。OSM未登録区間の網羅性は確認中。',
 bounds:[[36.6,138.1],[41.6,142.2]] as [number,number][],
 dcBounds:[[40.7,139.7],[42.3,141.8]] as [number,number][],
};
export function currentType(value?:string):CurrentType{return value==='ac'||value==='dc'?value:'unknown';}
// Preserve the existing geographic palettes; lower 154 kV has a distinct purple.
export function electricalColor(line:ElectricalDisplay,context:'trunk'|'lower'='trunk'){
 if(currentType(line.currentType)==='dc')return '#b02fa5';
 if(context==='lower')return line.voltageKV===154?'#8054aa':line.voltageKV===66?'#b26a20':'#277781';
 return line.voltageKV>=500?'#1558ac':line.voltageKV>=275?'#00816f':line.voltageKV>=220?'#976223':line.voltageKV>=187?'#5364ae':'#277781';
}
// 基幹系統+連系線の電圧の絞り込み。例外の線（trunkException、2026-10-14：東清水FCの東京側154kV）は対象電圧になくても通す。対象電圧（voltages）そのものには足さない
export function trunkVoltageShown(line:{voltageKV:number;trunkException?:string},voltages:Set<number>){return voltages.has(line.voltageKV)||!!line.trunkException;}
export function voltageFilterLabel(kv:number,records:ElectricalDisplay[]){
 const types=[...new Set(records.filter(r=>r.voltageKV===kv).map(r=>currentType(r.currentType)))];
 // A plain voltage label makes no AC assertion; keep compact chips when AC and unknown coexist.
 return types.includes('ac')&&!types.includes('dc')?String(kv):types.length===1&&types[0]==='dc'?'DC '+kv:
  `${kv} (${types.length?types.map(t=>t==='ac'?'AC':t==='dc'?'DC':'方式未確認').join('/'):'方式未確認'})`;
}
// DC-scoped facilities may register only the AC terminal voltage. The scope's
// explicitly DC line voltages control visibility, not the facility's AC rating.
export function dcScopeVisible(scope:ElectricalDisplay[],voltages:Set<number>,currents:Set<string>){
 return currents.has('dc')&&scope.some(l=>currentType(l.currentType)==='dc'&&voltages.has(l.voltageKV));
}

type LinkedLine=ElectricalDisplay&{connections?:{facilities:{id:string}[]}[]};
// 設備ID → つながる線（元の並び順）の索引を線の配列ごとに1回作る（以前は設備ごとに全線をなめていた。2026-10-10 表示速度の改善。配列の長さが変われば作り直す）
const linkIndexes=new WeakMap<readonly LinkedLine[],{size:number;index:Map<string,LinkedLine[]>}>();
function linkIndex(lines:readonly LinkedLine[]){
 const c=linkIndexes.get(lines);if(c&&c.size===lines.length)return c.index;
 const index=new Map<string,LinkedLine[]>();
 for(const l of lines){const ids=new Set((l.connections??[]).flatMap(e=>e.facilities.map(x=>x.id)));for(const id of ids){const a=index.get(id);if(a)a.push(l);else index.set(id,[l]);}}
 linkIndexes.set(lines,{size:lines.length,index});return index;
}
export function facilityElectricalVisible(f:{id:string;kind?:string;voltages:number[];scopeConnected?:boolean},lines:LinkedLine[],voltages:Set<number>,currents:Set<string>){
 const linked=linkIndex(lines).get(f.id)??[];
 // Plants with neither a recorded connecting line nor a registered voltage follow only the plant-kind toggle.
 if(!linked.length&&f.kind==='plant'&&!f.voltages.length)return true;
 return linked.length?linked.some(l=>voltages.has(l.voltageKV)&&currents.has(currentType(l.currentType))):currents.has('unknown')&&f.voltages.some(v=>voltages.has(v));
}
