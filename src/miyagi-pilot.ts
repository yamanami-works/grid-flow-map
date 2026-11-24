import {facilitySymbol} from './facility-symbol';
import {selectionStrokes} from './selection-style';
import {trunkDisplay,electricalColor} from './display-settings';
import L from 'leaflet';
import type {LinePicker} from './line-picker';
import {escapeHtml as esc,externalLink} from './safe-html';
import {lineWidth} from './line-style';
import {pilotVoltageColor,pilotCounts,type MiyagiPilot,type PilotCapacity,type PilotBank} from './miyagi-domain';
import './miyagi-pilot.css';
const el=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const mw=(v:number|null)=>v===null?'公表値なし':v+' MW';
/** Other 154/66 kV data shown in the same view: the 東清水 FC Tokyo-side 154 kV line, shown in both the trunk+tie view and this 154/66 kV view (2026-10-14). */
export type ExtraLowerLine={id:string;name:string;voltageKV:number;currentType?:string;paths:[number,number][][];attributes?:{label:string;value:string}[];connections?:{facilities:{id:string;name:string}[]}[]};
export type ExtraLowerFacility={id:string;name:string;kind:'substation'|'switchyard'|'plant'|'converter'|'customer';position:[number,number];voltages:number[]};
export const LOWER_RANGE_LABEL='154/66kV（検証中）';
export class MiyagiPilotView {
 active=false;
 private data:MiyagiPilot;
 private layer=L.layerGroup();
 private selected:string|null=null;
 private preview=false;
 private query='';
 private kvs:Set<number>;
 private facilities=true;
 private extraLines:ExtraLowerLine[]=[];
 private extraFacilities:ExtraLowerFacility[]=[];
 constructor(private map:L.Map,data:MiyagiPilot,private toggle:(active:boolean)=>void,private linePicker:LinePicker){
  this.data=data;this.kvs=new Set(data.display.voltages);
  // 基幹系統／下位系統の切替は、サイドバーの「地域」の右に置く
  el('#region-controls').insertAdjacentHTML('beforeend',`<div id="pilot-mode"><select id="pilot-mode-select" aria-label="電圧範囲（基幹系統+連系線／下位系統）"><option value="trunk" title="${esc(trunkDisplay.rangeLabel)}">基幹系統+連系線</option><option value="lower" title="${esc(LOWER_RANGE_LABEL)}">下位系統（検証中）</option></select></div>`);
  el('.map-area').insertAdjacentHTML('beforeend','<div id="pilot-legend" role="status"></div>');
  el<HTMLSelectElement>('#pilot-mode-select').onchange=e=>this.toggle((e.target as HTMLSelectElement).value==='lower');
  map.on('zoomend',()=>{if(this.active)this.draw();});
 }
 setActive(active:boolean){
  this.active=active;el('#app').classList.toggle('pilot-active',active);el<HTMLSelectElement>('#pilot-mode-select').value=active?'lower':'trunk';
  if(active){this.layer.addTo(this.map);this.render();this.fit();}else this.layer.remove();
 }
 get metadata(){return this.data.display;}
 setExtras(lines:ExtraLowerLine[],facilities:ExtraLowerFacility[]){this.extraLines=lines;this.extraFacilities=facilities;if(this.active)this.render();}
 private extras(){return this.extraLines.filter(l=>this.kvs.has(l.voltageKV)&&this.matches(l.name));}
 private extraFacilityList(){if(!this.facilities)return [];const ids=new Set(this.extras().flatMap(l=>(l.connections??[]).flatMap(c=>c.facilities.map(f=>f.id))));return this.extraFacilities.filter(f=>ids.has(f.id));}
 get electricalLines(){return this.data.lines;}
 get settings(){return {voltages:this.kvs};}
 toggleVoltage(kv:number){this.kvs.has(kv)?this.kvs.delete(kv):this.kvs.add(kv);this.selected=null;}
 setFacilities(value:boolean){if(this.facilities!==value){this.facilities=value;this.selected=null;}}
 search(value:string){this.query=value.normalize('NFKC').trim();this.selected=null;this.render();if(this.query){const points=[...this.lines().flatMap(l=>l.geometry.points),...this.facilityList().map(f=>f.position)];if(points.length)this.map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[30,155],paddingBottomRight:[45,150],maxZoom:13,animate:false});}}
 fit(){this.map.fitBounds(L.latLngBounds([...this.data.lines.flatMap(l=>l.geometry.points),...this.extraLines.flatMap(l=>l.paths.flat())]),{paddingTopLeft:[30,145],paddingBottomRight:[45,100],animate:false});}
 private matches(name:string,code=''){return (name+code).normalize('NFKC').includes(this.query);}
 private lines(){return this.data.lines.filter(l=>this.kvs.has(l.voltageKV)&&this.matches(l.name,l.capacity.officialId));}
 private facilityList(){return this.facilities?this.data.facilities.filter(f=>f.voltageKV.some(k=>this.kvs.has(k))&&this.matches(f.name,this.data.banks.filter(b=>b.facilityId===f.id).map(b=>b.officialId).join(' '))):[];}
 private pick(id:string,focus=false){this.preview=false;this.selected=id;el('.sidebar').classList.remove('mobile-open');el('#real-browse').textContent='⌕ 設備を探す';this.render();if(focus){const line=this.data.lines.find(l=>l.id===id),facility=this.data.facilities.find(f=>f.id===id);if(line)this.map.fitBounds(L.latLngBounds(line.geometry.points),{padding:[55,160],maxZoom:13,animate:false});else if(facility)this.map.setView(facility.position,13,{animate:false});else{const x=this.extraLines.find(l=>l.id===id),xf=this.extraFacilities.find(f=>f.id===id);if(x)this.map.fitBounds(L.latLngBounds(x.paths.flat()),{padding:[55,160],maxZoom:13,animate:false});else if(xf)this.map.setView(xf.position,13,{animate:false});}}}
 private showTarget(id:string,position:L.LatLngExpression,name:string,voltage:string,extra='',color='#39584c'){
  this.selected=id;this.preview=true;this.render();
  this.linePicker.showTarget(position,name,voltage,()=>this.pick(id),extra,color);
 }
 private draw(){
  this.layer.clearLayers();
  this.linePicker.setLines([...this.lines().map(l=>({id:l.id,label:`${l.name} · ${l.voltageKV} kV`,width:lineWidth(l.voltageKV),voltageKV:l.voltageKV,paths:[l.geometry.points],select:(position:L.LatLng)=>this.showTarget(l.id,position,l.name,l.voltageKV+' kV')})),...this.extras().map(l=>({id:l.id,label:`${l.name} · ${l.voltageKV} kV`,width:lineWidth(l.voltageKV),voltageKV:l.voltageKV,paths:l.paths,select:(position:L.LatLng)=>this.showTarget(l.id,position,l.name,l.voltageKV+' kV')}))]);
  for(const line of this.extras()){
   const color=electricalColor(line,'lower'),weight=lineWidth(line.voltageKV);
   if(this.selected===line.id)for(const style of selectionStrokes(line.voltageKV,line.currentType))L.polyline(line.paths,style).addTo(this.layer);
   L.polyline(line.paths,{color:'#fff',weight:weight+2,interactive:false}).addTo(this.layer);
   L.polyline(line.paths,{color,weight,smoothFactor:0}).bindTooltip(esc(line.name+' '+line.voltageKV+'kV（暫定）')).addTo(this.layer);
  }
  for(const f of this.extraFacilityList())L.marker(f.position,{icon:L.divIcon({className:'facility-symbol facility-'+f.kind+(this.selected===f.id?' facility-selected':''),html:facilitySymbol(f.kind),iconSize:[24,24],iconAnchor:[12,12]}),title:f.name,alt:f.name}).on('click',(e:L.LeafletMouseEvent)=>{if(this.linePicker.canTap(e.originalEvent))this.showTarget(f.id,f.position,f.name,f.voltages.join(' / ')+' kV');}).addTo(this.layer);
  for(const line of this.lines()){
   const color=electricalColor(line,'lower'),weight=lineWidth(line.voltageKV);
   if(this.selected===line.id)for(const style of selectionStrokes(line.voltageKV,line.currentType))L.polyline(line.geometry.points,style).addTo(this.layer);
   L.polyline(line.geometry.points,{color:'#fff',weight:weight+2,interactive:false}).addTo(this.layer);
   L.polyline(line.geometry.points,{color,weight,smoothFactor:0}).bindTooltip(esc(line.name+' '+line.voltageKV+'kV')).addTo(this.layer);
  }
  if(this.kvs.has(66)&&!this.query){const j=this.data.junction;L.circleMarker(j.position,{radius:4,color:'#40564f',fillColor:'#fff',fillOpacity:1,weight:2,bubblingMouseEvents:false}).bindTooltip(esc(j.name)).on('click',(e:L.LeafletMouseEvent)=>{if(this.linePicker.canTap(e.originalEvent))this.showTarget(j.id,j.position,j.name,'66 kV');}).addTo(this.layer);}
  for(const f of this.facilityList()){
   L.marker(f.position,{icon:L.divIcon({className:'facility-symbol facility-substation pilot-facility'+(this.selected===f.id?' facility-selected':''),html:facilitySymbol('substation'),iconSize:[24,24],iconAnchor:[12,12]}),title:f.name,alt:f.name}).on('click',(e:L.LeafletMouseEvent)=>{
    if(!this.linePicker.canTap(e.originalEvent))return;
    this.showTarget(f.id,f.position,f.name,f.voltageKV.join(' / ')+' kV');
   }).addTo(this.layer);
  }
 }
 render(){
  if(!this.active)return;
  const counts=pilotCounts(this.data);
  el('.real-banner').innerHTML=`<b>${esc(LOWER_RANGE_LABEL)}</b><span>${esc(this.data.scope)} ${counts.lines}路線・${counts.facilities}変電所${this.extraLines.length?`＋東清水FCの東京側接続線（暫定）${this.extraLines.length}路線`:''} / ${esc(this.data.display.coverageNote)}</span>`;
  el('#dataset-summary').textContent=this.data.display.summary;
  el('#result-heading').textContent='154/66kVの検証データ：線路・設備';
  const lines=this.lines(),facilities=this.facilityList(),extras=this.extras(),extraFacilities=this.extraFacilityList();el('#real-count').textContent=String(lines.length+facilities.length+extras.length+extraFacilities.length);
  el('#real-results').innerHTML=lines.map(l=>`<button class="result-item" data-pilot-select="${esc(l.id)}"><i class="real-swatch" style="background:${electricalColor(l,'lower')}"></i><span class="result-main"><b>${esc(l.name)}</b><small>${esc(l.voltageKV)}kV · 公表番号 ${esc(l.capacity.officialId)}</small></span></button>`).join('')+facilities.map(f=>`<button class="result-item" data-pilot-select="${esc(f.id)}"><span>□</span><span class="result-main"><b>${esc(f.name)}</b><small>${f.id===this.data.upper.facilityId?'上位275kVとの接続設備':f.upperReference?'154/66kV接続 · 上位経路未収録':'変電所 · バンクは別詳細'}</small></span></button>`).join('');
  el('#real-results').insertAdjacentHTML('beforeend',extras.map(l=>`<button class="result-item" data-pilot-select="${esc(l.id)}"><i class="real-swatch" style="background:${electricalColor(l,'lower')}"></i><span class="result-main"><b>${esc(l.name)}<span class="caution-tag">暫定</span></b><small>${esc(l.voltageKV)}kV · 東京（東清水FCの東京側）</small></span></button>`).join('')+extraFacilities.map(f=>`<button class="result-item" data-pilot-select="${esc(f.id)}"><i class="real-swatch" style="background:#244c7c"></i><span class="result-main"><b>${esc(f.name)}</b><small>${esc(f.voltages.join('/'))}kV · 東京</small></span></button>`).join(''));
  el('#real-results').querySelectorAll<HTMLButtonElement>('[data-pilot-select]').forEach(b=>b.onclick=()=>this.pick(b.dataset.pilotSelect!,true));
  const legend=el('#pilot-legend');
  legend.innerHTML=`<b>電圧</b> ${this.data.display.voltages.map(k=>`<i style="background:${pilotVoltageColor(k)}"></i>${esc(k)}kV`).join(' ')} <small>${esc(this.data.display.connectionLegend.replace(/^⇅\s*/,'上位接続：'))}</small>`;
  if(!lines.length&&!facilities.length&&!extras.length)el('#dataset-summary').textContent=this.kvs.size?'現在の表示設定・検索条件に該当する対象はありません。':'電圧フィルタですべて非表示にしています。対象電圧のボタンから再表示できます。';
  if(!lines.length&&!facilities.length&&!extras.length)legend.insertAdjacentHTML('beforeend','<small>表示設定・検索条件により対象を非表示にしています。</small>');
  this.draw();this.detail();
 }
 private capacity(c:PilotCapacity){return `<dl class="data-facts"><dt>設備容量</dt><dd>${mw(c.equipmentMW)}</dd><dt>運用容量</dt><dd>${mw(c.operatingMW)}</dd></dl><p>対象：${esc(c.source.target)}<br>公表版：${esc(c.source.published)}<br>取得：${esc(c.source.retrievedAt)}<br>公表番号：${esc(c.officialId)}</p><p>${esc(c.matchStatus)}</p>${externalLink(c.source.url,c.source.title)}`;}
 private bank(b:PilotBank){return `<article class="bank-card"><h3>${esc(b.primaryKV)}/${esc(b.secondaryKV)}kV 対象バンク行</h3><p>${esc(b.scope)} 台数：${esc(b.bankCount)}。容量は該当バンク行の値であり、線路や施設全体へ転用しません。</p>${this.capacity(b)}</article>`;}
 private button(id:string,label:string){return `<button class="pilot-link" data-pilot-link="${esc(id)}">${esc(label)}</button>`;}
 private detail(){
  const panel=el('#detail');panel.hidden=!this.selected||this.preview;if(!this.selected||this.preview)return;
  const extra=this.extraLines.find(l=>l.id===this.selected),extraFacility=this.extraFacilities.find(f=>f.id===this.selected);
  if(extra||extraFacility){
   const title=extra?extra.name+' '+extra.voltageKV+'kV':extraFacility!.name;
   const body=extra?`<dl class="data-facts">${(extra.attributes??[]).map(a=>`<dt>${esc(a.label)}</dt><dd>${esc(a.value)}</dd>`).join('')}</dl>`:`<p>${esc(extraFacility!.voltages.join(' / '))} kV。東京エリアの地図（500/275kV表示）でも表示します。</p>`;
   panel.innerHTML=`<button id="pilot-close" class="icon-button" aria-label="詳細を閉じる">×</button><h2>${esc(title)}</h2>${body}<p class="research-note">154/66kV（検証中）の暫定表示。東清水FCの東京側接続線（154kV）は、基幹系統+連系線と154/66kVの両方で表示します。</p>`;
   el('#pilot-close').onclick=()=>{this.selected=null;this.render();};return;
  }
  const line=this.data.lines.find(l=>l.id===this.selected),facility=this.data.facilities.find(f=>f.id===this.selected),bank=this.data.banks.find(b=>b.id===this.selected),j=this.data.junction;
  let title='',body='';
  if(line){title=line.name+' '+line.voltageKV+'kV';body=`<p><b>公表区間</b><br>${esc(line.publicSection)}（${esc(line.capacity.circuitCount)}回線）</p><p>${this.button(line.from,this.data.facilities.find(f=>f.id===line.from)?.name??j.name)} → ${this.button(line.to,this.data.facilities.find(f=>f.id===line.to)!.name)}</p>${line.name==='山下線'?this.button(j.id,'途中分岐：蛇田支線 → 蛇田'):''}<p><b>地理表示</b><br>${esc(line.geometry.status)}</p><details><summary>参照経路の照合根拠</summary><p>OSM way：${esc(line.geometry.wayIds.join(', '))}<br>端点node：${esc(line.geometry.nodeIds[0])} → ${esc(line.geometry.nodeIds.at(-1))}。近接接続・直線補完なし。</p></details>${this.capacity(line.capacity)}<p>一致するOCCTO公表実績なし。潮流値・流向アニメーションは未表示です。</p>`;}
  if(facility){title=facility.name;const banks=this.data.banks.filter(b=>b.facilityId===facility.id);body=`<p>施設ID：${esc(facility.id)}</p>${facility.id===this.data.upper.facilityId?`<div class="research-note"><b>上位との接続</b><p>鳴瀬幹線275kV（0122）：宮城 → 石巻<br>石巻275/154kVバンクを介して河南線154kVへ。個別母線・回線結線は未確認。</p><button id="pilot-upper">500/275kV・DCへ戻る</button></div>`:''}${facility.upperReference?`<div class="research-note"><b>上位との接続（地理経路未収録）</b><p>${esc(facility.upperReference.lineName)} ${esc(facility.upperReference.voltageKV)}kV（${esc(facility.upperReference.officialId)}）：${esc(facility.upperReference.publicSection)}</p><p>${esc(facility.upperReference.status)}</p><p>公表版：${esc(facility.upperReference.source.published)} / 取得：${esc(facility.upperReference.source.retrievedAt)}</p>${externalLink(facility.upperReference.source.url,'上位の公表区間：原表CSV')}</div>`:''}<p>公表接続：${this.data.lines.filter(l=>l.from===facility.id||l.to===facility.id).map(l=>this.button(l.id,l.name+' '+l.voltageKV+'kV')).join(' ')}</p>${banks.map(b=>this.bank(b)).join('')}`;}
  if(bank){title=this.data.facilities.find(f=>f.id===bank.facilityId)!.name+' · バンク';body=this.button(bank.facilityId,'施設の詳細')+this.bank(bank);}
  if(this.selected===j.id){title=j.name;body=`<p>${esc(j.status)}</p><p>OSM共有node：${esc(j.osmNode)}</p>${this.data.lines.filter(l=>l.name==='山下線'||l.name==='蛇田支線').map(l=>this.button(l.id,l.name)).join(' ')}<p>異電圧の変換点ではありません。分岐から蛇田変電所まで同じ66kV参照経路を表示しています。</p>`;}
  panel.innerHTML=`<button id="pilot-close" class="icon-button" aria-label="詳細を閉じる">×</button><h2>${esc(title)}</h2>${body}<p class="research-note">${esc(this.data.note)}<br>利用・再配布条件：pending（限定検証）。購入資格の付与ではありません。</p><details><summary>接続関係の一次資料</summary>${this.data.sourceMaps.map(s=>`<p>${externalLink(s.url,s.title)}<br>${esc(s.published)} / 取得 ${esc(s.retrievedAt)}</p>`).join('')}<p>図自体は複製掲載していません。</p></details>`;
  el('#pilot-close').onclick=()=>{this.selected=null;this.render();};
  panel.querySelectorAll<HTMLButtonElement>('[data-pilot-link]').forEach(b=>b.onclick=()=>{this.query='';el<HTMLInputElement>('#real-search').value='';this.pick(b.dataset.pilotLink!);});
  const upper=panel.querySelector<HTMLButtonElement>('#pilot-upper');if(upper)upper.onclick=()=>this.toggle(false);
 }
}
