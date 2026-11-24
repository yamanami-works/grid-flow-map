import {escapeHtml as esc,externalLink} from './safe-html.ts';
export type PlanTiming={raw:string;label:string;precision:'month'|'year'|'fiscal-year'|'unknown';year?:number;month?:number;qualifier?:'on-or-after'};
export type PlanRevision={recordedAt:string;before:string;after:string;timing:PlanTiming[];status:'計画中'|'工事中'|'運用開始確認済み'|'延期'|'中止';statusOriginal:string;source:{name:string;url:string;publishedAt:string|null;checkedAt:string};reason:string};
export type ChangePlan={latestProgressReview?:{checkedAt:string|null;note:string};id:string;regions:string[];targets:{name:string;assetIds:string[];mapping:string}[];changeType:string;revisions:PlanRevision[];unknowns?:string[];updateRequired?:string[];application?:{status:string;note:string}};
export const currentRevision=(p:ChangePlan)=>p.revisions[p.revisions.length-1];
// Bounds are for ordering/review only: never turn an approximate public date into an operation date.
function bound(t:PlanTiming,end=false){
 if(t.year===undefined||t.precision==='unknown')return Infinity;
 const month=t.precision==='month'?t.month!:t.precision==='fiscal-year'?(end?15:4):(end?12:1);
 return Date.UTC(t.year,month-(end?0:1),1)-9*60*60*1000;
}
export function planNeedsReview(p:ChangePlan,now=Date.now()){
 const r=currentRevision(p);return !['運用開始確認済み','中止'].includes(r.status)&&r.timing.some(t=>t.qualifier!=='on-or-after'&&bound(t,true)<=now);
}
export function plansForRegion(plans:ChangePlan[],region:string){
 return plans.filter(p=>region==='national'||p.regions.includes(region)).slice().sort((a,b)=>Math.min(...currentRevision(a).timing.map(t=>bound(t)))-Math.min(...currentRevision(b).timing.map(t=>bound(t)))||a.id.localeCompare(b.id));
}
const timingText=(r:PlanRevision)=>r.timing.map(t=>`${t.label}：${t.raw}`).join(' ／ ')||'時期未定';
const PLANS_TEXT='<p>調査で確認できた公表計画の一覧です。全計画の網羅は保証せず、予定は変更される場合があります。</p><p>予定時期の概略順（年度・年・月・未定の精度を保持）。予定だけで現行地図を更新しません。状況は公表資料時点です。</p>';
// 参考資料（2026-11-07：表の説明の下に全地域で1行）。資料の時点を表示名に添える（四半期ごとの版のため）。中身（各計画の進捗）は計画の記録には反映していない
export const PLANS_REFERENCE={label:'広域整備計画の進捗状況（電力広域的運営推進機関・2026年度第1四半期・2026年9月1日・PDF）',url:'https://www.occto.or.jp/assets/iinkai/kouikikeitouseibi/103/seibi_103_04_01.pdf'};
const PLANS_NOTE=PLANS_TEXT+`<p class="plans-reference">参考資料：${externalLink(PLANS_REFERENCE.url,PLANS_REFERENCE.label)}</p>`;
const reviewMark=(p:ChangePlan,now:number)=>planNeedsReview(p,now)?'<strong class="plan-review">予定時期経過・運用開始未確認</strong>':'';
// 1件の計画の中身（変更前後・時期・状況・出典・確認日・未確認事項・履歴）。一覧の表の「詳細」と plansMarkup で共通
// 未確認事項・反映状況・更新対象の記録がない計画（佐久間東幹線など）でも止まらないよう、無いときは「記録なし」
function planBody(p:ChangePlan,now:number){
 const r=currentRevision(p);
 return `<p><b>${esc(p.changeType)}</b>：${esc(r.before)} → ${esc(r.after)}</p><p><b>予定時期：</b>${esc(timingText(r))}</p><p><b>状況：</b>${esc(r.status)}（資料表記：${esc(r.statusOriginal)}）${reviewMark(p,now)}</p>${externalLink(r.source.url,r.source.name)}<p>公表日：${esc(r.source.publishedAt??'記載未確認')} ／ 資料を確認した日：${esc(r.source.checkedAt)}</p><p>予定・工事進捗の最新性を確認した日：${esc(p.latestProgressReview?.checkedAt??'未確認')}。${esc(p.latestProgressReview?.note??'公表後の予定変更・工事進捗の最新性は未確認。資料確認日とは異なります。')}</p><details><summary>未確認事項・反映状況・記録履歴</summary><p>${esc((p.unknowns??[]).join('。')||'記録なし')}</p><p>アプリ：${esc(p.application?.status??'記録なし')}。${esc(p.application?.note??'')}</p><p>更新対象：${esc((p.updateRequired??[]).join('・')||'記録なし')}</p><p>資産対応：${esc(p.targets.map(t=>t.name+'：'+(t.assetIds.join(', ')||t.mapping)).join(' ／ '))}</p>${p.revisions.map(v=>`<p>${esc(v.recordedAt)}：${esc(timingText(v))}／${esc(v.status)}。${esc(v.reason)} ${esc(v.before)} → ${esc(v.after)}</p>${externalLink(v.source.url,'この記録の根拠')}`).join('')}</details>`;
}
export function plansMarkup(plans:ChangePlan[],region:string,now=Date.now()){
 const selected=plansForRegion(plans,region);
 return PLANS_NOTE+(selected.length?selected.map(p=>`<article class="change-plan"><h3>${esc(p.targets.map(t=>t.name).join('・'))}</h3>${planBody(p,now)}</article>`).join(''):'<p>記録済みの変更予定はありません。</p>');
}
// 地図の上の一覧の表（2026-11-03）。対象は、計画のデータに記録済みの assetIds が地図の線・設備に一致するときだけ押せる。
// 名前の一致では判定せず、新しく対応づけない。両端の設備にだけ対応した記録（宮城丸森など）は押せない。「既存資産に対応」以外は記録の対応を併記し、OSM が根拠のものは要注意
export type PlanTarget={kind:'line'|'facility';id:string};
export function planTargetOf(t:ChangePlan['targets'][number],resolve:(assetId:string)=>PlanTarget|null){
 if(t.mapping.includes('両端'))return null;
 for(const id of t.assetIds){const hit=resolve(id);if(hit)return hit;}
 return null;
}
function targetMarkup(t:ChangePlan['targets'][number],resolve:((assetId:string)=>PlanTarget|null)|null,pending:string){
 if(!resolve)return `<span class="plan-target-off">${esc(t.name)}</span><small>（${esc(pending)}）</small>`;
 const hit=planTargetOf(t,resolve);
 if(!hit)return `<span class="plan-target-off">${esc(t.name)}</span><small>（地図に未収録）</small>`;
 const note=t.mapping==='既存資産に対応'?'':`<small class="plan-map-note">${t.mapping.includes('OSM')?'<b class="plan-caution">要注意</b>':''}対応：${esc(t.mapping)}</small>`;
 return `<button type="button" class="plan-target" data-plan-kind="${esc(hit.kind)}" data-plan-id="${esc(hit.id)}">${esc(t.name)}</button>${hit.kind==='facility'?'<small>（設備）</small>':''}${note}`;
}
// resolve が null の間（地図の読み込み中など）は押せる対象を決めず、pending の文を添える
export function plansTableMarkup(plans:ChangePlan[],region:string,resolve:((assetId:string)=>PlanTarget|null)|null,now=Date.now(),pending='確認中'){
 const selected=plansForRegion(plans,region);
 if(!selected.length)return PLANS_NOTE+'<p>記録済みの変更予定はありません。</p>';
 const rows=selected.map((p,i)=>{
  const r=currentRevision(p);
  return `<tr><td>${p.targets.map(t=>`<span class="plan-target-row">${targetMarkup(t,resolve,pending)}</span>`).join('')}</td><td>${esc(p.changeType)}</td><td>${r.timing.map(t=>esc(t.raw)).join('<br>')||'時期未定'}</td><td><span class="plan-status" data-status="${esc(r.status)}">${esc(r.status)}</span>${reviewMark(p,now)}</td><td><button type="button" class="plan-more" aria-expanded="false" aria-controls="plan-more-${i}">詳細</button></td></tr><tr id="plan-more-${i}" class="plan-more-row" hidden><td colspan="5">${planBody(p,now)}</td></tr>`;
 }).join('');
 return PLANS_NOTE+`<table class="plans-table"><thead><tr><th scope="col">対象（押すと地図で選択）</th><th scope="col">変更</th><th scope="col">予定時期<span class="plans-sp">・状況</span></th><th scope="col">状況</th><th scope="col"><span class="plans-sr">詳細</span></th></tr></thead><tbody>${rows}</tbody></table>`;
}
