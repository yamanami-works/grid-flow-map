import {createHash} from 'node:crypto';
// Only the reviewed Hokuto endpoint aliases are applied. Other rows stay verbatim.
export function hokkaidoSnapshot(actual,capacity,date,retrievedAt){
 const rows=d=>{const t=d.root?.bizRoot?.table?.table1?.table1;if(d.root?.errMessage||!t||Number(t.totalPage)>1||!t.rows.length)throw Error('Incomplete OCCTO response');return t.rows;};
 const num=v=>{const text=String(v??'').trim().replaceAll(',','');return text!==''&&Number.isFinite(Number(text))?Number(text):null;};
 const ends=(name,s)=>s.split('→').map(v=>{v=v.trim();return name==='北斗幹線'?({'北斗CS':'北斗変換所','大野SS':'大野変電所'}[v]??v):v;});
 // 運用容量がOCCTO側で未公表（YA000010SW 該当データなし）の日は容量なし＝参考使用率は不明として実績だけ使う（2026-10-09 北陸）
 const noCapacity=[capacity?.root?.errMessage].flat().some(m=>m?.msgId==='YA000010SW');
 const capacities=noCapacity?[]:rows(capacity).map(r=>{const name=r.sdlNm.value,[from,to]=ends(name,r.flowHukuSeiHuku1.value);return {id:'hk-cap-'+r.sdlNo.value,name,voltageKV:num(r.daKv1.value),from,to,capacityMW:num(r.unyr.value),constraint:r.ktiYuin.value};});
 const h=actual.root.bizRoot.header,keys=Object.keys(h).filter(k=>/^colonLbl\d+$/.test(k)).sort((a,b)=>h[a].label.localeCompare(h[b].label));
 if(keys.length!==48)throw Error('Invalid time columns');
 const lines=rows(actual).map(r=>{const name=r.sdlNm.value,voltageKV=num(r.daKv.value),[from,to]=ends(name,r.flowHukuSeiHuku.value);return {id:'hk-'+createHash('sha256').update([name,voltageKV,from,to].join('|')).digest('hex').slice(0,16),name,voltageKV,from,to,note:'OCCTO北海道公表実績。北斗幹線以外は地理照合未完了。',values:keys.map(k=>num(r[k]?.value))};});
 return {date,retrievedAt,sourceUrl:'https://www.occto.or.jp/institution/keitoujouhou/index.html',attribution:'出典：OCCTO系統情報サービス（北海道）。本アプリで区間照合・参考使用率を加工。',actual:{times:keys.map(k=>date+'T'+h[k].label+':00'),originalTimes:keys.map(k=>date+' '+h[k].label),lines},capacities};
}
