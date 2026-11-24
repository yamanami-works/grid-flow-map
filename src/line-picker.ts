import L from 'leaflet';
import {lineHits,TapGesture,type XY} from './line-hit';
export type PickLine={id:string;label:string;width:number;voltageKV?:number;paths:[number,number][][];select:(position:L.LatLng)=>void};
type Projected={line:PickLine;paths:XY[][];box:{x0:number;y0:number;x1:number;y1:number}};
export class LinePicker {
 private lines:PickLine[]=[];
 private gesture=new TapGesture();
 private moving=false;
 private popup:L.Popup|undefined;
 // 線の座標はズームごとに1回だけ画面の座標（map.project を整数に丸める＝以前の latLngToContainerPoint と同じ丸め）に直して使い回す（以前はクリックのたびに全線を直していた。2026-10-10）
 private projected:{zoom:number;lines:Projected[]}|null=null;
 constructor(private map:L.Map){
  const container=map.getContainer();
  container.addEventListener('pointerdown',e=>this.gesture.down(e.pointerId,{x:e.clientX,y:e.clientY}),{capture:true,passive:true});
  container.addEventListener('pointermove',e=>this.gesture.move(e.pointerId,{x:e.clientX,y:e.clientY}),{capture:true,passive:true});
  window.addEventListener('pointerup',e=>{this.gesture.move(e.pointerId,{x:e.clientX,y:e.clientY});this.gesture.up(e.pointerId);},{capture:true,passive:true});
  window.addEventListener('pointercancel',e=>this.gesture.cancel(e.pointerId),{capture:true,passive:true});
  map.on('movestart zoomstart',()=>{this.moving=true;this.gesture.blocked=true;});
  map.on('dragstart zoomstart',()=>this.close());
  map.on('moveend zoomend',()=>{this.moving=false;});
  map.on('click',(e:L.LeafletMouseEvent)=>{
   const target=e.originalEvent.target;
   if(this.moving||this.gesture.blocked||target instanceof Element&&target.closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control'))return;
   const hits=this.hitsAt(e.latlng);
   this.close();
   if(hits.length===1){this.lines.find(l=>l.id===hits[0].id)?.select(e.latlng);return;}
   if(hits.length>1){
    const content=document.createElement('div');content.className='line-pick-options';
    const heading=document.createElement('b');heading.textContent='重なる送電線を選択';content.append(heading);
    for(const hit of hits){const button=document.createElement('button');button.type='button';button.textContent=hit.label;button.style.cssText='display:block;width:100%;padding:10px;margin-top:5px;text-align:left;border:1px solid #c6d5cc;border-radius:5px;background:white;color:#254f42';button.onclick=()=>{const line=this.lines.find(l=>l.id===hit.id);this.close();line?.select(e.latlng);};content.append(button);}
    L.DomEvent.disableClickPropagation(content);L.DomEvent.disableScrollPropagation(content);
    this.popup=L.popup({maxWidth:280,maxHeight:220}).setLatLng(e.latlng).setContent(content).openOn(map);
   }
  });
 }
 /** 今のズームの画面座標（ズームが変わった時・線が変わった時だけ作り直す） */
 private projection(){
  const zoom=this.map.getZoom();
  if(!this.projected||this.projected.zoom!==zoom)this.projected={zoom,lines:this.lines.map(line=>{const paths=line.paths.map(p=>p.map(ll=>{const q=this.map.project(ll,zoom).round();return {x:q.x,y:q.y};}));let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of paths)for(const q of p){if(q.x<x0)x0=q.x;if(q.x>x1)x1=q.x;if(q.y<y0)y0=q.y;if(q.y>y1)y1=q.y;}return {line,paths,box:{x0,y0,x1,y1}};})};
  return this.projected;
 }
 /** クリック判定（以前と同じ lineHits。座標を作り直さないだけ。画面座標は平行移動しても距離は同じ） */
 private hitsAt(at:L.LatLng){
  const {zoom,lines}=this.projection(),p=this.map.project(at,zoom),pt={x:p.x,y:p.y},reach=Math.max(...this.lines.map(l=>l.width*5),20);
  return lineHits(pt,lines.filter(x=>pt.x>=x.box.x0-reach&&pt.x<=x.box.x1+reach&&pt.y>=x.box.y0-reach&&pt.y<=x.box.y1+reach).map(x=>({id:x.line.id,label:x.line.label,width:x.line.width,voltageKV:x.line.voltageKV,paths:x.paths})));
 }
 canTap(event?:Event){return !this.moving&&(event instanceof KeyboardEvent||!this.gesture.blocked);}
 showTarget(position:L.LatLngExpression,name:string,voltage:string,open:()=>void,extra='',color='#39584c'){
  this.close();
  const settings=document.querySelector<HTMLElement>('#mobile-layers');if(settings)settings.hidden=true;
  document.querySelector('#mobile-layers-toggle')?.setAttribute('aria-expanded','false');
  const button=document.createElement('button');button.type='button';button.className='map-target-card';button.style.borderLeftColor=color;
  for(const [tag,text] of [['strong',name],['span',voltage],['span',extra],['small','詳細を開く ›']]){if(!text)continue;const row=document.createElement(tag);row.textContent=text;button.append(row);}
  button.onclick=e=>{e.stopPropagation();this.close();open();};
  L.DomEvent.disableClickPropagation(button);L.DomEvent.disableScrollPropagation(button);
  const bounds=this.map.getContainer().getBoundingClientRect();
  const bottomPanels=Array.from(document.querySelectorAll<HTMLElement>('#real-time,#pilot-legend')).filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect()).filter(r=>r.top>bounds.top+bounds.height/2&&r.top<bounds.bottom);
  const bottomPadding=Math.max(150,...bottomPanels.map(r=>bounds.bottom-r.top+12));
  this.popup=L.popup({className:'map-target-popup',closeButton:false,maxWidth:240,autoPanPaddingTopLeft:[20,205],autoPanPaddingBottomRight:[20,bottomPadding]}).setLatLng(position).setContent(button).openOn(this.map);
 }
 setLines(lines:PickLine[]){this.close();this.lines=lines;this.projected=null;}
 private close(){if(this.popup)this.map.closePopup(this.popup);this.popup=undefined;}
}
