import {lineWidth,type WidthProfile} from './line-style.ts';
// Below the normal voltage stroke; never changes hit testing or particle widths. Solid for DC too (2026-11-07: DC is told apart by colour only).
export const selectionPane='selection-outline';
export function selectionStrokes(voltageKV:number,currentType?:string,profile:WidthProfile='default'){
 const common={pane:selectionPane,interactive:false,smoothFactor:0,opacity:1,
  dashArray:undefined,lineCap:'butt' as const,lineJoin:'round' as const};
 const width=lineWidth(voltageKV,profile,currentType);
 return [{...common,color:'#34434b',weight:width+7},{...common,color:'#fff',weight:width+4}];
}
