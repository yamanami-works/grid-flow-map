// 東北の OCCTO の応答（実績・運用容量）を1日分のデータにする（scripts/import-occto.mjs から分けた。2026-10-30 オーナー承認 保留33）
// 運用容量がOCCTO側で未公表（YA000010SW 該当データなし）の日は容量なし＝参考使用率は不明として実績だけ使う。ほかの誤りは止める
// 線の ID は運用容量の行の番号から決めるため、容量が空の日は idCapacities（その日か直近の日に取れた容量）で決め、ID を変えない
export function tohokuSnapshot(actual,capacity,date,sources,geography,idCapacities=[]){
 const clean=s=>s.normalize('NFKC').replace(/\s/g,'').replace(/^東北電力(?:ネットワーク)?/,'').replace(/(?:変電所|開閉所|変換所)$/,'');
 const resolve=name=>{const matches=geography.facilities.filter(f=>clean(f.name)===clean(name));return new Set(matches.map(f=>f.name)).size===1?matches[0].name:name.trim();};
 const num=s=>{const t=String(s??'').replace(/,/g,'').trim();return t!==''&&Number.isFinite(Number(t))?Number(t):null;};
 const rows=d=>{if(d.root.errMessage)throw Error('OCCTO error');const t=d.root.bizRoot.table.table1.table1;if(Number(t.totalPage)>1)throw Error('Incomplete page');return t.rows;};
 const noCapacity=[capacity?.root?.errMessage].flat().some(m=>m?.msgId==='YA000010SW');
 const caps=noCapacity?[]:rows(capacity).map(r=>({id:r.sdlNo.value.padStart(4,'0'),name:r.sdlNm.value,voltageKV:num(r.daKv1.value),from:resolve(r.flowHukuSeiHuku1.value.split('→')[0]),to:resolve(r.flowHukuSeiHuku1.value.split('→')[1]),capacityMW:num(r.unyr.value),constraint:r.ktiYuin.value}));
 const idCaps=caps.length?caps:idCapacities;
 const header=actual.root.bizRoot.header;
 const keys=Object.keys(header).filter(k=>/^colonLbl\d+$/.test(k)).sort((a,b)=>header[a].label.localeCompare(header[b].label));
 if(keys.length!==48)throw Error('Expected 48 half-hour columns');
 const lines=rows(actual).map((r,i)=>{const name=r.sdlNm.value,voltageKV=num(r.daKv.value),ends=r.flowHukuSeiHuku.value.split('→').map(resolve);const c=idCaps.filter(c=>c.name===name&&c.voltageKV===voltageKV);return {id:c.length===1?c[0].id:`occto-${i}`,name,voltageKV,from:ends[0],to:ends[1],note:'OCCTO公表実績。地理対応は参考。',values:keys.map(k=>num(r[k]?.value))};});
 return {schemaVersion:1,date,area:'東北',retrievedAt:sources[0].retrievedAt,attribution:'出典：電力広域的運営推進機関 系統情報サービス。名称対応・可視化・参考使用率計算は本アプリによる加工。',sourceUrl:'https://www.occto.or.jp/institution/keitoujouhou/index.html',capacityBasis:'対象日の最大需要時の運用容量。各30分断面の容量ではない。',sources,actual:{times:keys.map(k=>`${date}T${header[k].label}:00`),originalTimes:keys.map(k=>`${date.replaceAll('-','/')} ${header[k].label}`),lines},capacities:caps};
}
