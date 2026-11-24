// Width represents regional trunk hierarchy, never flow or capacity.
export const regionalLineWidths={hokkaido:{275:6,187:3.5},shikoku:{187:3.5}} as const;
// 四国電力の基幹系統は500kVと187kV（2026-10-02）：187kVを北海道と同じく第2階層の太さに
export type WidthProfile='default'|'hokkaido'|'shikoku';
export const lineWidth=(kv:number,profile:WidthProfile='default',currentType?:string)=>profile==='hokkaido'&&currentType==='ac'&&kv in regionalLineWidths.hokkaido?regionalLineWidths.hokkaido[kv as 275|187]:profile==='shikoku'&&currentType==='ac'&&kv===187?regionalLineWidths.shikoku[187]:kv>=500?6:kv>=275||(kv===220&&currentType!=='dc')?3.5:kv>=154?2.8:2; // 220kV交流は中国電力の基幹系統（275kVと同じ太さ）
// 直流の粒子は線より太くする（2026-10-23、案A）：細い直流の線（2.8px・白縁）の内側に収まると、線と白縁に埋もれて見えない（直流の破線は 2026-11-07 に廃止）
export const DC_PARTICLE_EXTRA=1;
export const particleWidth=(kv:number,profile:WidthProfile='default',currentType?:string)=>currentType==='dc'?lineWidth(kv,profile,currentType)+DC_PARTICLE_EXTRA:lineWidth(kv,profile,currentType)*0.75;
// 北海道・四国の線のID・資産IDを配列ごとに Set にして引く（2026-10-10 表示速度の改善。配列の長さが変われば作り直す）
const idSets=new WeakMap<readonly {id:string;assetId?:string}[],{size:number;ids:Set<string>}>();
const idSet=(xs:readonly {id:string;assetId?:string}[])=>{let c=idSets.get(xs);if(!c||c.size!==xs.length){c={size:xs.length,ids:new Set(xs.flatMap(x=>x.assetId?['id:'+x.id,'asset:'+x.assetId]:['id:'+x.id]))};idSets.set(xs,c);}return c.ids;};
export function lineWidthProfile(line:{id:string;assetId?:string},hokkaidoLines:readonly {id:string;assetId?:string}[],shikokuLines:readonly {id:string;assetId?:string}[]=[]):WidthProfile{
 const has=(xs:readonly {id:string;assetId?:string}[])=>{const s=idSet(xs);return s.has('id:'+line.id)||!!line.assetId&&s.has('asset:'+line.assetId);};
 return has(hokkaidoLines)?'hokkaido':has(shikokuLines)?'shikoku':'default';
}
