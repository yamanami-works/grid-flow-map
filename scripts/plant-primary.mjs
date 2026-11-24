// 発電所の発電方式の一次資料を設備に反映する（2026-10-10 オーナー承認）。一覧は docs/research/plant-primary-sources.json。
// - 属性「発電方式（一次資料）」（方式・細区分・出力など）と「出典（発電方式）」、必要なら「注記（発電方式）」を付ける。地図のマーク（src/plant-sources.ts）は、この属性を最優先に tools/build-plant-sources.mjs が決める（2026-10-17。それまでは変えなかった）。
// - rename：正式名を変え、元の名前は属性「別名」に残す。線の接続先の名前も合わせる（線名は変えない）。
// - addFacilities：一次資料から設備を足す（region のデータにだけ）。
// 全 builder が通る scripts/jpower.mjs の取り込みの最後（廃止の反映の前）で呼ぶ。
import {readFileSync,existsSync} from 'node:fs';
const FILE='docs/research/plant-primary-sources.json';
const note=(x,label,value)=>{x.attributes=[...(x.attributes??[]).filter(a=>a.label!==label),{label,value}];};
export function applyPlantPrimary(region,lines,facilities){
 if(!existsSync(FILE))return 0;
 const d=JSON.parse(readFileSync(FILE,'utf8'));let n=0;
 for(const a of d.addFacilities??[])if(a.region===region&&!facilities.some(f=>f.id===a.facility.id))facilities.push(structuredClone(a.facility));
 for(const f of facilities){const e=d.plants[f.id];if(!e||f.kind!=='plant')continue;
  if(e.rename&&f.name!==e.rename.name){const old=f.name;f.name=e.rename.name;note(f,'別名',e.rename.alias??old);note(f,'名称の確認（一次資料）',e.rename.basis);
   for(const l of lines)for(const c of l.connections??[])for(const x of c.facilities??[])if(x.id===f.id)x.name=f.name;}
  note(f,'発電方式（一次資料）',e.method+(e.subtype?'・'+e.subtype:'')+(e.detail?'（'+e.detail+'）':''));
  // 確認日は資料ごと（sources[].checkedAt、2026-10-13〜）。なければ一覧全体の checkedAt
  note(f,'出典（発電方式）',e.sources.map(s=>`${s.name}（${s.url} 、${s.checkedAt??d.checkedAt}確認）`).join(' ／ '));
  if(e.note)note(f,'注記（発電方式）',e.note);
  // 詳細パネルの「種別」カードの値（2026-10-10）。種別の根拠にした出典に forType:true があれば、カードの出典はそれだけにする（2026-10-19。「出典（発電方式）」には全部を残す）。
  // 一次資料の書き方のまま。細区分（純揚水・混合揚水）と注記は補足に出す
  if(e.type)f.plantType={label:e.type,...(e.subtype&&e.subtype!=='揚水'?{detail:e.subtype}:{}),...(e.note?{note:e.note}:{}),source:(e.sources.some(s=>s.forType)?e.sources.filter(s=>s.forType):e.sources).map(s=>s.name).join(' ／ ')};
  n++;}
 return n;
}
