// 複数の公表元を合わせた日（全国・連系線入り）は、全公表元がそろう最新の時刻（commonLatest）を最新とする。
// 公表のタイミングは地域ごとにずれ、一番進んだ地域の時刻にすると他の地域が欠測になって一部しか流れない（2026-10-04）。
export function latestIndex(snapshot:{commonLatest?:number;actual:{times:string[];lines:{values:(number|null)[]}[]}}){
 if(snapshot.commonLatest!=null)return snapshot.commonLatest;
 for(let i=snapshot.actual.times.length-1;i>=0;i--)
  if(snapshot.actual.lines.some(l=>l.values[i]!==null&&Number.isFinite(l.values[i])))return i;
 return 0;
}
