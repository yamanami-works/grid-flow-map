// 西日本エリア（中部・北陸・関西・中国・四国・九州）の線を、東京で使った照合区分の規則で判定し直す（2026-10-03 オーナー指示「C区分が多いので、確定に近づけて」）。
// 規則（docs/TOKYO_275_BLOCK.md と同じ）：A＝同名線のみ（＋両端の1径間程度の引込）、B＝派生名・共架表記・途中分岐のない無名区間・分岐端点、
// C＝別名経由・他設備通過・途切れの直線補完・所在地で名称を当てた設備・公表区間なし（電源線・連系線）。D（直線）はそのまま。
// 公表区間の根拠は OCCTO の地内実績行（区間名と両端）。地理はOSMのまま（個別回線・母線は未確認）。
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {kmText} from './km-text.mjs';
const LEAD_M=400;
const TERMINAL_M=2000; // 途中分岐の判定から除く端の範囲 // 両端の無名引込として認める長さ
const dist=(a,b)=>{const t=Math.PI/180,x=(b[1]-a[1])*t*Math.cos((a[0]+b[0])/2*t),y=(b[0]-a[0])*t;return 6371000*Math.hypot(x,y);};
const len=p=>p.slice(1).reduce((s,x,i)=>s+dist(p[i],x),0);
// 派生名：線種の語尾（幹線・支線・線）を除いた語幹が一致、または一方が他方を含む（西谷線／西谷北線、上津役線／上津役幹線）
const stem=n=>n.replace(/(幹線|支線|連絡線|線)$/,'');
const derived=(a,b)=>{const x=stem(a),y=stem(b);return x.length>=2&&y.length>=2&&(x.startsWith(y)||y.startsWith(x));};
const PREFIX=/^(関西電力(送配電)?|中部電力(パワーグリッド)?|北陸電力(送配電)?|中国電力(ネットワーク)?|四国電力(送配電)?|九州電力(送配電)?|電源開発|J-?POWER)[（(株)）\s]*/;
export const baseName=n=>n.normalize('NFKC').replace(/\s+/g,'').replace(/背振/g,'脊振').replace(/(\d)L/g,'$1号線').replace(PREFIX,'').replace(/\(.*?\)$/,'').replace(/[A-Za-z][A-Za-z\s\-]*$/,'');
function osmIndex(region){
 const dir=`data/raw/${region}-osm/`,ways=new Map(),deg=new Map(),nodes=new Map();
 for(const f of readdirSync(dir).filter(f=>/^lines-\d+\.json$/.test(f)))for(const e of JSON.parse(readFileSync(dir+f,'utf8')).elements)if(e.type==='way'&&e.tags)ways.set(e.id,e);else if(e.type==='node')nodes.set(e.id,[e.lat,e.lon]);
 for(const w of ways.values())for(const [i,n] of w.nodes.entries()){if(!deg.has(n))deg.set(n,new Set());deg.get(n).add(w.id);void i;}
 return {ways,deg,nodes};
}
// 複数の原本（ディレクトリ・ファイル）を合わせた索引（東京：地域の原本 data/raw/tokyo-osm は275kVだけのため、2026-11-04 保留70）。
// 送電線（power=line/cable）の way だけを入れ、変電所の区画などは deg に入れない。同じ way は後に読んだ原本が優先（重複の件数を返す）。
// out geom の原本は節点の座標を way の geometry から補う（途中分岐の判定が座標なしで黙って効かなくなるのを防ぐ）。
export function osmIndexDirs(paths){
 // tagDiffers：重複した way のうち線名・電圧のタグが原本どうしで違うものの ID（区分は線名・電圧で決まるので、使う線分にあれば呼ぶ側で止める）
 const ways=new Map(),deg=new Map(),nodes=new Map(),tagDiffers=new Set();let duplicates=0,differing=0;
 const files=paths.flatMap(p=>statSync(p).isDirectory()?readdirSync(p).filter(f=>/\.json$/.test(f)&&!/\.source\.json$/.test(f)).map(f=>p.replace(/\/$/,'')+'/'+f):[p]);
 for(const f of files)for(const e of JSON.parse(readFileSync(f,'utf8')).elements??[]){
  if(e.type==='node'&&e.lat!=null)nodes.set(e.id,[e.lat,e.lon]);
  else if(e.type==='way'&&/^(line|cable)$/.test(e.tags?.power??'')){
   const old=ways.get(e.id);if(old){duplicates++;if(old.nodes.join()!==e.nodes.join())differing++;if((old.tags.name??'')!==(e.tags.name??'')||(old.tags.voltage??'')!==(e.tags.voltage??''))tagDiffers.add(e.id);}
   ways.set(e.id,e);if(e.geometry)e.nodes.forEach((n,i)=>{const g=e.geometry[i];if(g&&!nodes.has(n))nodes.set(n,[g.lat,g.lon]);});}}
 for(const w of ways.values())for(const n of w.nodes){if(!deg.has(n))deg.set(n,new Set());deg.get(n).add(w.id);}
 return {ways,deg,nodes,files:files.length,duplicates,differing,tagDiffers};
}
// 線ごとの判定：{tier, reasons[]}
export function classify(line,{ways,deg,nodes},facilityById){
 const has=l=>line.attributes?.some(a=>a.label===l);
 // D区分は「両端が公表資料で確定し、経路だけ不明な直線」。端が推定の分岐点なら直線でもC（推測）（2026-10-03 指摘4b）
 if(line.schematic)return line.connections?.every(e=>e.facilities?.length)?{tier:'D',reasons:['直線（経路不明）']}:{tier:'C',reasons:['分岐点を推定した直線（経路も不明）']};
 // 各社の系統空容量一覧に載るが、端点を公表資料と照合できない線（2026-10-04 公表台帳から描いた線。推定を含む）
 if(!has('公表区間')&&(has('公表の行')||has('公表の線名')))return {tier:'C',reasons:[has('推定の内容')?'公表の線名・端点が伏せられているか照合できず、手がかりから推定した':'公表の線名はあるが、端点を公表資料と照合できない']};
 if(!has('公表区間'))return {tier:'C',reasons:['公表区間なし（電源線・連系線）']};
 const reasons=[],b=[],c=[];
 if(line.schematicParts?.length)c.push('OSMの途切れを直線で補完');
 // OCCTOの行の端点をオーナー判断で読み替えた線（属性「潮流の読み替え」）は、公表区間の両端と地図の端点が一致しないので A・B にしない（2026-10-25 九州 新鹿児島線）
 if(has('潮流の読み替え'))c.push('OCCTOの行の端点を読み替え');
 if(has('注記（経路）'))c.push('途中の設備区画を通過');
 for(const e of line.connections){const f=e.facilities[0];if(!f){b.push('分岐端点（共有ノード）');continue;}
  const fac=facilityById.get(f.id);if(fac?.attributes?.some(a=>a.label==='名称・位置の根拠')&&!fac.attributes.some(a=>a.label==='位置の確認'))c.push(`所在地で名称を当てた設備（${f.name}）`);}
 const want=baseName(line.name.replace(/[（(].*$/,''));
 const ids=line.osmIds.filter(x=>x>0),segs=line.osmIds.map((id,i)=>({id,m:len(line.paths[i]),i}));
 let named=0,unnamed=0,other=0;const otherNames=new Set();
 for(const s of segs){if(s.id<0)continue;const w=ways.get(s.id);const nm=w?.tags?.name;
  const isLead=(s.i===0||s.i===segs.length-1)&&s.m<=LEAD_M;
  if(!nm){if(isLead)continue;unnamed+=s.m;
   // 途中分岐：無名線分の中間ノードに経路外の同電圧の線が付いていないか
   // 端の設備付近（TERMINAL_M以内）は引込・2ルートの分かれ目が集まるので除く
   const kv=String(line.voltageKV*1000);
   // 2026-11-10 保留106（オーナー回答「案B」）：調べるのは線が通る区間だけ（経路の点と座標が一致した最初と最後の節点の間）。照合できなければ止める（way が索引にないときは前と同じく調べない）。
   // 線が way の途中で別の線分へ移り、way がその先へ続く点（線の端から TERMINAL_M 超）も分岐に数える（以前は way の全節点を見ていた）
   const key=p=>p[0].toFixed(6)+','+p[1].toFixed(6),used=new Set((line.paths[s.i]??[]).map(key));
   const hit=w?w.nodes.map((n,k)=>nodes.get(n)&&used.has(key(nodes.get(n)))?k:-1).filter(k=>k>=0):[];if(w&&hit.length<2)throw Error('途中分岐の判定：経路の点と way の節点が照合できない '+line.id+' way '+s.id+' '+hit.length);
   const lo=w?Math.min(...hit):0,hi=w?Math.max(...hit):0,far=n=>{const p=nodes.get(n);return p&&line.connections.every(e=>dist(p,e.position)>TERMINAL_M);};
   const inner=w?w.nodes.slice(lo,hi+1).filter(far):[],cont=w?[lo>0?w.nodes[lo]:null,hi<w.nodes.length-1?w.nodes[hi]:null].filter(n=>n&&far(n)):[];
   if(cont.length||inner.some(n=>[...(deg.get(n)??[])].some(x=>!ids.includes(x)&&String(ways.get(x)?.tags?.voltage??'').split(';').includes(kv))))c.push('途中で分岐する無名線分');continue;}
  const parts=nm.split(/[;・\/]/).map(baseName);
  if(baseName(nm)===want){named+=s.m;continue;}
  if(parts.includes(want)){named+=s.m;b.push('共架・派生表記（'+nm+'）');continue;}
  if(parts.some(p=>derived(p,want))){named+=s.m;b.push('派生名（'+nm+'）');continue;}
  if(isLead){b.push('引込が別名（'+nm+'）');continue;}
  other+=s.m;otherNames.add(nm);}
 if(other>0)c.push('別名の線を経由（'+[...otherNames].join('、')+'）');
 // 小数1桁で 0.0 になる短い区間は「0.1km未満」と書く（「約0.0km」と読めないように。2026-11-04 オーナー指示 保留74、scripts/km-text.mjs）
 if(unnamed>0)b.push(`無名区間 ${kmText(unnamed)}`);
 const tier=c.length?'C':b.length?'B':'A';
 return {tier,reasons:[...new Set(tier==='C'?c:b)],named,unnamed,other};
}
export function regionIndex(region){return existsSync(`data/raw/${region}-osm/`)?osmIndex(region):null;}
// 設備の名称・位置を国土地理院の地図注記で確かめた結果（scripts/check-gsi-anno.mjs → docs/research/gsi-facility-check.json）
const gsi=existsSync('docs/research/gsi-facility-check.json')?new Map(JSON.parse(readFileSync('docs/research/gsi-facility-check.json','utf8')).facilities.filter(f=>f.match).map(f=>[f.id,f.match])):new Map();
const C_NOTE='一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。';
// 線と設備の照合区分を付け直す（builder から呼ぶ）。D区分（直線）はそのまま。
export function applyTiers(region,lines,facilities){
 const idx=regionIndex(region);
 for(const f of facilities){const m=gsi.get(f.id);if(!m)continue;
  f.attributes=[...(f.attributes??[]).filter(a=>!a.label.startsWith('要注意（C区分）')&&a.label!=='位置の確認'),{label:'位置の確認',value:`国土地理院の地図注記「${m.knj}」が設備の中心から約${m.m}m（電子国土基本図の注記、z15）。名称と位置を国の地図で確認。`}];}
 const fb=new Map(facilities.map(f=>[f.id,f]));
 const count={A:0,B:0,C:0,D:0};
 for(const l of lines){if(l.attributes?.some(a=>a.label.startsWith('要注意（D区分'))&&l.connections?.every(e=>e.facilities?.length)){count.D++;continue;}
  const t=classify(l,idx,fb);count[t.tier]++;
  const rest=(l.attributes??[]).filter(a=>!a.label.startsWith('要注意（C区分）')&&a.label!=='照合区分'&&a.label!=='照合の根拠');
  const why=t.tier==='A'?'OCCTO公表区間の両端の設備に、同名のOSM線（＋両端の短い引込）だけで到達。':t.tier==='B'?'OCCTO公表区間の両端に到達。'+t.reasons.join('、')+'。':t.reasons.join('、')+'。';
  // 「端点の一次資料」がある電源線（tools/prep/adopt-plant-extra-lines.mjs、2026-10-15）は両端が一次資料で確定しているので、C_NOTE（端点も未確定）を使わない
  const note=l.attributes?.some(a=>a.label==='公表区間')?'公表区間の両端は分かるが、OSMの経路との対応を確定できない参考表示（理由は照合の根拠）。':l.attributes?.some(a=>a.label==='端点の一次資料')?'両端は一次資料で確定（端点の一次資料）。経路はOSMの地理登録をもとに描いた参考表示（理由は照合の根拠・地理参照）。':C_NOTE;
  l.attributes=[...(t.tier==='C'?[{label:'要注意（C区分）',value:note}]:[]),{label:'照合区分',value:t.tier+'区分'},{label:'照合の根拠',value:why},...rest];}
 return count;
}
