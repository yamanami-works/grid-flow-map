// 四国の 187kV：新改・奈半利川（長山線・奈半利川支線・二又線・魚梁瀬線）、讃岐・坂出・香川（讃岐坂出線・坂出火力線・香川線）、壬生川・西条火力（壬生川線・西条火力線）、
// 大川支線、鳴門淡路線（2026-11-10 オーナー指示、保留107 オーナー回答「いずれも承認」）。scripts/build-shikoku.mjs から呼ぶ。
// 一次資料：四国電力送配電の系統図と送電線・変電所の一覧（202611 版）。端点の「変N」は変電所一覧の番号、「<N>」は発電所番号（名前は伏せ字）。
// 地理は OSM（data/raw/shikoku-osm）。大川支線は OSM に線がなく、国土地理院の送電線記号をなぞった経路。どの線も前提（way・節点・区画）が変われば止める。
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
export const MAP2='四国電力送配電「四国エリアの送電系統（187kV以上の特高系統）」と送電線・変電所の一覧（https://www.yonden.co.jp/nw/assets/line_access/data/sys_capa_kikan00_map_202611_08.pdf 、2026年11月1日更新、2026-11-10確認）';
const JP='J-POWER 水力発電所一覧（https://www.jpower.co.jp/bs/renewable_energy/hydro/ichiran.html 、2026年7月1日現在、2026-11-10確認）';
const GSI='国土地理院 ベクトルタイル（試験公開、experimental_bvmap ズーム16、地物の送電線 ftCode 8202、2026-11-10取得）を加工';
const PHOTO='国土地理院 シームレス空中写真（seamlessphoto ズーム18、2026-11-10取得。撮影年は未確認）';
const OWNER='（2026-11-10 オーナー承認 保留107）';
// 大川支線：讃岐鳴門線の OSM の頂点（node 1188994507）の約7m先から北へ、国土地理院の送電線記号をなぞった点（南→北、大川変電所の区画内まで）
const OKAWA_GSI=[[34.2082276,134.2108297],[34.2083341,134.2109598],[34.2097781,134.2127435],[34.2113452,134.2144775],[34.2114417,134.2145848],[34.2118022,134.2149831],[34.2118909,134.2150824],[34.2123633,134.2156054],[34.2133348,134.2166662],[34.2154187,134.2189394],[34.2163447,134.2195617],[34.2164334,134.2196207],[34.2166674,134.2197789],[34.2169535,134.2199707],[34.2171132,134.220078],[34.2190639,134.2213896],[34.220887,134.2224464],[34.2209757,134.2224973],[34.2216743,134.2229037],[34.225001,134.224513],[34.2252305,134.2246243],[34.225429,134.2247128],[34.2255177,134.2247531],[34.2260644,134.2249998],[34.2271001,134.2254639],[34.2273385,134.2255712],[34.2282322,134.2259721],[34.2299708,134.2264777],[34.2300595,134.2265032],[34.2322316,134.2271362],[34.2333338,134.2282158],[34.2345124,134.2293705],[34.2346011,134.2294577],[34.2346654,134.2295207],[34.2390537,134.230615],[34.2391424,134.2306378],[34.2392111,134.2306553],[34.2416668,134.2300437],[34.2435947,134.2295542],[34.2436834,134.2295314],[34.2439839,134.2294563],[34.2461479,134.228936],[34.2481355,134.2286624],[34.2482242,134.2286503],[34.2488639,134.2285632],[34.2500001,134.2281434],[34.2506331,134.2279114],[34.2511707,134.2285323],[34.2511863,134.2286731]];
const OKAWA_ID=-1235469190; // 記号でなぞった区間の仮ID（負）

const raw=read('data/raw/shikoku-osm/lines-187.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
const W=new Map(els.filter(e=>e.type==='way').map(e=>[e.id,e]));
const facRaw=read('data/raw/shikoku-osm/facilities.json');
const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10),facAt=facRaw.osm3s?.timestamp_osm_base?.slice(0,10);
if(!osmAt||!facAt)throw Error('奈半利川ほか：OSMの取得時点が原本にない');
const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180));
const km=ps=>ps.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
const pos=n=>{const p=np.get(n);if(!p)throw Error('奈半利川ほか：node '+n+' がない');return p;};
// 区画（way は1つの輪、relation は外周の輪の集まり）
function rings(type,id){const e=facRaw.elements.find(x=>x.type===type&&x.id===id);if(!e)throw Error(`奈半利川ほか：設備の区画 ${type} ${id} がない`);
 return {e,rs:e.geometry?[e.geometry.map(q=>[q.lat,q.lon])]:e.members.filter(m=>m.geometry&&m.role!=='inner').map(m=>m.geometry.map(q=>[q.lat,q.lon]))};}
const inArea=(p,f)=>f.rings.some(r=>inside(p,r));
// way を順につないで経路にする。pieces：{way, from?, to?}（from・to は節点。省略時は前の線分の終点から向きを決め、way の端まで）
function chain(label,start,pieces){
 let at=start;const paths=[],ids=[];
 for(const pc of pieces){const w=W.get(pc.way);if(!w)throw Error(label+'：way '+pc.way+' がない');
  const from=pc.from??at;let i=w.nodes.indexOf(from);if(i<0)throw Error(`${label}：way ${pc.way} が節点 ${from} を通らない`);
  let j=pc.to!=null?w.nodes.indexOf(pc.to):(i===0?w.nodes.length-1:i===w.nodes.length-1?0:-1);if(j<0||j===i)throw Error(`${label}：way ${pc.way} の終点を決められない`);
  if(at!=null&&from!==at)throw Error(`${label}：way ${pc.way} が前の線分とつながらない`);
  const ns=i<j?w.nodes.slice(i,j+1):w.nodes.slice(j,i+1).reverse();paths.push(ns.map(pos));ids.push(pc.way);at=ns.at(-1);}
 return {paths,ids,end:at};}
const conn=(node,position,f)=>({node,position,status:f?'facility-area':'shared-node',facilities:f?[{id:f.id,name:f.name}]:[],neighborWays:[]});
const set=(x,label,value)=>{const a=[...(x.attributes??[])],i=a.findIndex(y=>y.label===label);if(i<0)a.push({label,value});else a[i]={label,value};x.attributes=a;};

// ---- 設備（builder の取り込み（jpower.mjs・plant-primary）より前に足す） ----
const FAC=[
 {key:'shinkai',type:'way',id:567592345,name:'新改変電所',kind:'substation',voltages:[187,66],tag:'187000;66000',
  basis:`${MAP2}の変電所一覧の No.14「新改変電所」（187/66kV。送電線の一覧では「新改開閉所（変14）」）。No.22 新改高知線（変14→変13）・No.23 新改幹線（変14→変12）・No.39 長山線の端。この区画は、新改幹線・新改高知線・長山線の OSM の線が入る 187;66kV の変電所の区画で、隣の新改発電所（四国電力、9,300kW の水力）とは別の設備。名前を当てたのは推定${OWNER}。`},
 {key:'nahari',type:'way',id:844182802,name:'奈半利川変電所',kind:'substation',voltages:[187,66],tag:'187000;66000',
  basis:`${MAP2}の変電所一覧の No.15「奈半利川変電所」（187/66kV）。系統図で No.42 奈半利川支線・No.43 二又線の端。この区画は、二又線・奈半利川支線の OSM の線が入る 187;66kV の変電所の区画（オーナー指示の座標 北緯33.462535・東経134.050388 から約36m）。名前を当てたのは推定${OWNER}。`},
 {key:'nagayama',type:'relation',id:11579756,name:'長山発電所',kind:'plant',voltages:[187],
  basis:`${MAP2}の系統図で No.39 長山線の端の発電所 <16>（名前は伏せ字）。<16> を長山発電所としたのは、線名と系統図の位置（奈半利川変電所の隣）による推定${OWNER}。${JP}：長山（高知県安芸郡北川村、奈半利川、電源開発）。この区画は、長山線の OSM の線が入る名前のない水力発電所の区画（隣の 187kV の開閉所の区画 way 844182799 を含めて1つの設備とする）。`,
  operator:'電源開発'},
 {key:'yanase',type:'way',id:844165231,name:'魚梁瀬発電所',kind:'plant',voltages:[187],
  basis:`${MAP2}の系統図で No.44 魚梁瀬線の端の発電所 <33>（名前は伏せ字）。<33> を魚梁瀬発電所としたのは、線名と系統図の位置による推定${OWNER}。${JP}：魚梁瀬（高知県安芸郡北川村、奈半利川/安田川、電源開発）。この区画は、魚梁瀬線の OSM の線が入る名前のない水力発電所の区画（国土地理院の注記「魚梁瀬ダム」から約500m。隣の 187kV の区画 way 1037463586 を含めて1つの設備とする）。`,
  operator:'電源開発'},
 {key:'okawa',type:'way',id:1235469190,name:'大川変電所',kind:'substation',voltages:[187,66],tag:'187000;66000',osmName:'大川変電所',
  basis:`${MAP2}の変電所一覧の No.29「大川変電所」（187/66kV）。系統図で No.33 大川支線の端。OSM の区画の名前も「大川変電所」（四国電力送配電）。`},
 {key:'nyugawa',type:'way',id:704208233,name:'壬生川変電所',kind:'substation',voltages:[187,66],tag:'187000;66000',
  basis:`${MAP2}の変電所一覧の No.23「壬生川変電所」（187/66kV）。系統図で No.18 壬生川線の端。この区画は、壬生川線の OSM の線が入る 187;66kV の変電所の区画（オーナー指示の座標 北緯33.931413・東経133.112319 から約31m）。名前を当てたのは推定${OWNER}。`},
 {key:'saijokaryoku',type:'way',id:620976976,name:'西条火力変電所',kind:'substation',voltages:[187,66],tag:'187000;66000',
  basis:`${MAP2}の変電所一覧の No.24「西条火力変電所」（187/66kV）。系統図で No.17 西条火力線・No.18 壬生川線の端。この区画は、2本の OSM の線が入る 187;66kV の変電所の区画で、西条発電所（国土地理院の注記「四国電力西条発電所」）の構内。名前を当てたのは推定${OWNER}。`},
 {key:'seidan',type:'way',id:724287148,name:'西淡変電所',kind:'substation',voltages:[187,77],tag:'187000;77000',
  basis:`${MAP2}の系統図で、鳴門変電所（No.9）から「関西エリア 西淡（変）」へ向かう矢印（線番号なし）。この区画は、鳴門から淡路島へ向かう 187kV の OSM の線が行き着く 187;77kV の変電所の区画（兵庫県南あわじ市、関西エリア）。名前を当てたのは推定${OWNER}。`,
  operator:'関西電力送配電',area:'関西エリア（兵庫県・淡路島）。四国電力送配電の系統図の外の設備で、四国の地図データに載せる'},
];
export function addNahariFacilities(facilities){
 const out={};
 for(const s of FAC){const {e,rs}=rings(s.type,s.id);
  if(e.tags?.power!==(s.kind==='plant'?'plant':'substation'))throw Error(`${s.name}：OSMの区画の種類が想定と違う`);
  if(s.tag&&e.tags.voltage!==s.tag)throw Error(`${s.name}：OSMの電圧が想定と違う（${e.tags.voltage}）`);
  if((e.tags.name??null)!==(s.osmName??null))throw Error(`${s.name}：OSMの名前が想定と違う（${e.tags.name}）`);
  const id=`osm-${s.type}-${s.id}`;if(facilities.some(f=>f.name===s.name&&f.id!==id))throw Error(s.name+'：同じ名前の設備が既にある');
  const vs=rs.flatMap(r=>r.slice(0,-1)),p=[vs.reduce((a,q)=>a+q[0],0)/vs.length,vs.reduce((a,q)=>a+q[1],0)/vs.length];
  if(!rs.some(r=>inside(p,r)))throw Error(s.name+'：代表点が区画の外');
  let f=facilities.find(x=>x.id===id);if(!f){f={id,assetId:`shikoku-fac-${s.type}-${s.id}`,name:s.name,kind:s.kind,position:p,voltages:s.voltages,scopeConnected:true,url:`https://www.openstreetmap.org/${s.type}/${s.id}`,attributes:[]};facilities.push(f);}
  f.name=s.name;
  f.attributes=[...(s.osmName?[{label:'名称の照合',value:s.basis}]:[{label:'要注意（C区分）',value:'名前のない地図データの区画に、一次資料の名称を当てた設備（位置は一次資料にない）。'},{label:'名称の根拠',value:s.basis}]),
   ...(s.operator?[{label:'事業者',value:s.operator+(s.kind==='plant'?`（${JP}）`:'（オーナー指示 2026-11-10。四国電力送配電の系統図では「関西エリア」）')}]:[]),
   ...(s.area?[{label:'エリア',value:s.area}]:[]),
   {label:'OSM登録',value:`OSMの区画（${s.type} ${s.id}、power=${e.tags.power}${e.tags.voltage?'、'+e.tags.voltage.split(';').map(v=>v/1000).join('/')+'kV':''}、${e.tags.name?'名前「'+e.tags.name+'」':'名前の登録なし'}${e.tags.operator?'、事業者 '+e.tags.operator:''}、${facAt}時点）。`},
   {label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'}];
  out[s.key]={...f,rings:rs};}
 return out;
}

// ---- 線（end-fixes のあと、照合区分の判定の前） ----
const SRC='四国電力送配電 系統空容量（基幹系統・送電線）一覧（202611 版の系統図 PDF と同じ番号）';
export function applyNahariLines(lines,facilities){
 const F={};for(const s of FAC){const id=`osm-${s.type}-${s.id}`,f=facilities.find(x=>x.id===id);if(!f)throw Error(s.name+'：設備がない');F[s.key]={...f,rings:rings(s.type,s.id).rs};}
 const fac=id=>{const f=facilities.find(x=>x.id===id);if(!f)throw Error('設備 '+id+' がない');return f;};
 const futamata=fac('osm-way-844182805'),sakaide=fac('osm-way-605687599'),sanuki=fac('osm-way-87538349'),kagawa=fac('osm-way-87491654'),saijo=fac('osm-way-173327088'),naruto=fac('osm-way-722498909'),shinkaiPS=fac('osm-relation-11583778'),saijoPS=fac('osm-way-704208234');
 if(futamata.name!=='二又水力発電所'||sakaide.name!=='坂出火力発電所'||sanuki.name!=='讃岐変電所'||kagawa.name!=='香川変電所'||saijo.name!=='西条変電所'||naruto.name!=='鳴門変電所'||shinkaiPS.name!=='新改発電所'||saijoPS.name!=='西条発電所')throw Error('奈半利川ほか：既存の設備が想定と違う');
 const line=id=>{const l=lines.find(x=>x.id===id);if(!l)throw Error('線 '+id+' がない');return l;};
 const endIn=(label,p,f)=>{if(!inArea(p,f))throw Error(`${label}：端が${f.name}の区画の外`);};
 const geo=(ids,extra='')=>`OSM ${ids.length}線分（${ids.map(i=>'way '+i).join('・')}）。${extra}地理はOSM（data/raw/shikoku-osm/lines-187.json ${osmAt}時点）。`;
 const NO1=7874840884,NO1P=pos(NO1);
 const made=[];
 // No.39 長山線：新改変電所 → No.1 → 長山発電所（1回線、電源開発）
 {const c=chain('長山線',9441384276,[{way:1023830341},{way:844182798,to:NO1},{way:844182796,to:7874840811}]);
  endIn('長山線',c.paths[0][0],F.shinkai);endIn('長山線',c.paths.at(-1).at(-1),F.nagayama);
  made.push({id:'shikoku-187-長山線',name:'長山線',c,from:conn(9441384276,c.paths[0][0],F.shinkai),to:conn(c.end,c.paths.at(-1).at(-1),F.nagayama),
   row:'No.39「長山線」187kV、1回線。区間は「新改開閉所（変14）→送39 No.1」と「送39 No.1→<16>発電所」の2行（予想潮流 -146MW は一覧の想定値で実績ではない。潮流は表示しない）。系統図の凡例で他社設備（一点鎖線）。',
   map:`変14＝新改変電所、<16>＝長山発電所とみなした（推定。発電所番号の名前は資料に出ない）。送39 No.1 は長山線の分岐点で、奈半利川支線（No.42）がここから奈半利川変電所へ出る。地図では OSM の線の共有点（node ${NO1}、奈半利川変電所の区画から約60m）を No.1 とみなした（推定）。`,
   kind:'新改変電所と長山発電所を結ぶ 187kV・1回線の線（電源開発の設備）。途中の No.1 で奈半利川支線が分かれる。',
   geo:geo(c.ids,'新改側の引込（way 1023830341）から OSM の 1回線の線（way 844182798、約39km）で No.1 まで、No.1 から長山発電所の区画まで（way 844182796）。'),
   why:['両端は一次資料（系統図・一覧）で新改変電所〜長山発電所と分かるが、<16>（長山発電所）の対応は推定で、経路は OSM の名前のない線分だけで描いた参考表示。','No.39 の端点は一次資料。発電所番号 <16> を長山発電所とみなした（推定）。経路は OSM の名前のない線分（C区分）。'],operator:'電源開発'});}
 // No.42 奈半利川支線：No.1 → 奈半利川変電所（2回線）
 {const c=chain('奈半利川支線',NO1,[{way:1037463605}]);endIn('奈半利川支線',c.paths.at(-1).at(-1),F.nahari);
  made.push({id:'shikoku-187-奈半利川支線',name:'奈半利川支線',c,from:conn(NO1,NO1P,null),to:conn(c.end,c.paths.at(-1).at(-1),F.nahari),
   row:'No.42「奈半利川支線」187kV、2回線、潮流正方向 送39 No.1→変15（予想潮流 0MW は一覧の想定値で実績ではない。潮流は表示しない）。',
   map:`変15＝奈半利川変電所。起点の送39 No.1（長山線の分岐点）は、OSM の線の共有点（node ${NO1}）とみなした（推定）。`,
   kind:'長山線の No.1 から奈半利川変電所へ入る 187kV・2回線の短い線（約0.1km）。',
   geo:geo(c.ids,'OSM の引込は1回線の登録。'),
   why:['奈半利川変電所の端は一次資料で分かるが、起点の No.1 の位置は推定（OSM の線の共有点）。','No.42 の端点は一次資料。No.1 の位置を OSM の共有点とみなした（推定）。経路は OSM の名前のない線分（C区分）。']});}
 // No.43 二又線：二又発電所 → 奈半利川変電所（以前の「二又水力発電所の連系線」の ID）
 {const l=line('shikoku-plant-187-way-844182805');if(l.name!=='二又水力発電所の連系線'||l.osmIds.join()!=='844182803,844182798,789804061')throw Error('二又線：以前の線が想定と違う');
  const c=chain('二又線',7874840896,[{way:844182803,to:NO1},{way:1037463604}]);endIn('二又線',c.paths[0][0],{rings:rings('way',844182805).rs,name:'二又水力発電所'});endIn('二又線',c.paths.at(-1).at(-1),F.nahari);
  made.push({id:l.id,old:l,oldName:l.name,oldKm:km(l.paths),name:'二又線',c,from:conn(7874840896,c.paths[0][0],futamata),to:conn(c.end,c.paths.at(-1).at(-1),F.nahari),
   row:'No.43「二又線」187kV、1回線（潮流方向・予想潮流は「―」）。系統図では発電所 <32> と奈半利川変電所（15）を結ぶ。',
   map:'<32>＝二又水力発電所とみなした（推定。発電所番号の名前は資料に出ない）。系統図で No.43 は <32> から奈半利川変電所へ入る。',
   kind:'二又水力発電所と奈半利川変電所を結ぶ 187kV・1回線の線（電源開発の設備）。',
   geo:geo(c.ids,'二又側から OSM の 1回線の線（way 844182803、約11km）で長山線の No.1 の点を通り、奈半利川変電所の区画まで（way 1037463604）。No.1 は通るだけで、長山線とはつながない。'),
   fix:`以前は「二又水力発電所の連系線」として、OSM の線を共有点でたどり新改発電所まで（約${km(l.paths).toFixed(1)}km）描いていた。そのうち No.1 から新改までは長山線（No.39）なので、この線は二又〜奈半利川変電所に直した${OWNER}。ID は残した。`,
   why:['両端は一次資料（系統図）で二又水力発電所〜奈半利川変電所と分かるが、<32>（二又）の対応は推定で、経路は OSM の名前のない線分だけで描いた参考表示。','No.43 の端点は系統図による。発電所番号 <32> を二又水力発電所とみなした（推定）。経路は OSM の名前のない線分（C区分）。'],operator:'電源開発'});}
 // No.44 魚梁瀬線：魚梁瀬発電所 → 二又水力発電所
 {const c=chain('魚梁瀬線',7874840938,[{way:844182806}]);endIn('魚梁瀬線',c.paths[0][0],F.yanase);endIn('魚梁瀬線',c.paths.at(-1).at(-1),{rings:rings('way',844182805).rs,name:'二又水力発電所'});
  made.push({id:'shikoku-187-魚梁瀬線',name:'魚梁瀬線',c,from:conn(7874840938,c.paths[0][0],F.yanase),to:conn(c.end,c.paths.at(-1).at(-1),futamata),
   row:'No.44「魚梁瀬線」187kV、1回線（潮流方向・予想潮流は「―」）。系統図では発電所 <33> と <32> を結ぶ。',
   map:'<33>＝魚梁瀬発電所、<32>＝二又水力発電所とみなした（推定。発電所番号の名前は資料に出ない）。',
   kind:'魚梁瀬発電所と二又水力発電所を結ぶ 187kV・1回線の線（電源開発の設備）。',
   geo:geo(c.ids,'OSM の 1回線の線（約9km）で、両端とも発電所の区画の内側。'),
   why:['両端は一次資料（系統図）で発電所 <33>〜<32> と分かるが、魚梁瀬・二又への対応は推定で、経路は OSM の名前のない線分だけで描いた参考表示。','No.44 の端点は系統図による。発電所番号を魚梁瀬・二又とみなした（推定）。経路は OSM の名前のない線分（C区分）。'],operator:'電源開発'});}
 // No.33 大川支線：讃岐鳴門線の No.69 → 大川変電所（2回線）。経路は国土地理院の送電線記号
 {const sn=line('shikoku-187-讃岐鳴門線');if(!sn.osmIds.includes(102958862)||!W.get(102958862).nodes.includes(1188994507))throw Error('大川支線：讃岐鳴門線の分岐の点が変わった');
  const b=pos(1188994507);if(dm(b,OKAWA_GSI[0])>15)throw Error('大川支線：記号の起点が讃岐鳴門線から離れた');endIn('大川支線',OKAWA_GSI.at(-1),F.okawa);
  const path=[b,...OKAWA_GSI],c={paths:[path],ids:[OKAWA_ID],end:null};
  made.push({id:'shikoku-187-大川支線',name:'大川支線',c,from:conn(1188994507,b,null),to:{node:null,position:OKAWA_GSI.at(-1),status:'facility-area',facilities:[{id:F.okawa.id,name:F.okawa.name}],neighborWays:[]},
   row:'No.33「大川支線」187kV、2回線、潮流正方向 送32 No.69→変29（予想潮流 153MW は一覧の想定値で実績ではない。潮流は表示しない）。No.32 讃岐鳴門線は「変4→送32 No.69」「送32 No.69→変9」の2行に分かれる。',
   map:`変29＝大川変電所。起点の送32 No.69（讃岐鳴門線の鉄塔）は、国土地理院の送電線記号が讃岐鳴門線の記号から分かれる点に最も近い、讃岐鳴門線の OSM の頂点（node 1188994507、約7m）とみなした（推定）。鉄塔の番号は地図では確かめていない。`,
   kind:'讃岐鳴門線の No.69 から大川変電所へ入る 187kV・2回線の線。',
   geo:`OSM に線がないので、${GSI}した経路（約${km([path]).toFixed(1)}km、${path.length}点）。記号は分岐点から大川変電所の区画まで途切れずに1本でたどれる。経路の形の根拠は国土地理院の記号だけで、線名・電圧・接続先は記号から決めていない。`,
   why:['両端は一次資料（系統図・一覧）で讃岐鳴門線 No.69〜大川変電所と分かるが、No.69 の位置は推定で、経路は国土地理院の送電線記号だけで描いた参考表示。','No.33 の端点は一次資料。No.69 の位置を記号の分かれ目とみなした（推定）。経路は国土地理院の送電線記号（C区分）。']});}
 // No.18 壬生川線：壬生川変電所 → 西条火力変電所（2回線）
 {const c=chain('壬生川線',6612233574,[{way:704208235,to:6612233567},{way:1037121642}]);endIn('壬生川線',c.paths[0][0],F.nyugawa);endIn('壬生川線',c.paths.at(-1).at(-1),F.saijokaryoku);
  made.push({id:'shikoku-187-壬生川線',name:'壬生川線',c,from:conn(6612233574,c.paths[0][0],F.nyugawa),to:conn(c.end,c.paths.at(-1).at(-1),F.saijokaryoku),
   row:'No.18「壬生川線」187kV、2回線、潮流正方向 変23→変24（予想潮流 292MW は一覧の想定値で実績ではない。潮流は表示しない）。',
   map:'変23＝壬生川変電所、変24＝西条火力変電所。',kind:'壬生川変電所と西条火力変電所を結ぶ 187kV・2回線の線。',
   geo:geo(c.ids,'OSM の 2回線の線（約5.5km）と西条火力変電所側の引込。'),
   why:['両端は一次資料（系統図・一覧）で壬生川変電所〜西条火力変電所と分かるが、両端の設備は名前のない地図データの区画に名前を当てたもので、経路は OSM の名前のない線分だけで描いた参考表示。','No.18 の端点は一次資料。経路は OSM の名前のない線分（C区分）。']});}
 // No.17 西条火力線：西条火力変電所 → 西条変電所（以前の「西条発電所の連系線」の ID、約0.7km 延ばす）
 {const l=line('shikoku-plant-187-way-704208234');if(l.name!=='西条発電所の連系線'||l.osmIds.join()!=='620976979,1037448452')throw Error('西条火力線：以前の線が想定と違う');
  const c=chain('西条火力線',9554129735,[{way:1037121674},{way:1037121680},{way:1037121682},{way:1037121681},{way:620976979},{way:1037448452}]);
  endIn('西条火力線',c.paths[0][0],F.saijokaryoku);endIn('西条火力線',c.paths.at(-1).at(-1),{rings:rings('way',173327088).rs,name:'西条変電所'});
  made.push({id:l.id,old:l,oldName:l.name,name:'西条火力線',c,from:conn(9554129735,c.paths[0][0],F.saijokaryoku),to:conn(c.end,c.paths.at(-1).at(-1),saijo),
   row:'No.17「西条火力線」187kV、2回線、潮流正方向 変24→変25（予想潮流 1,075MW は一覧の想定値で実績ではない。潮流は表示しない）。',
   map:'変24＝西条火力変電所、変25＝西条変電所。',kind:'西条火力変電所と西条変電所を結ぶ 187kV・2回線の線。',
   geo:geo(c.ids,'西条火力変電所側の約0.7km（way 1037121680・1037121682・1037121681。1037121682・1037121681 は OSM で 187;66kV・4回線の共架）と、以前からの OSM の線（way 620976979）・西条変電所の引込。'),
   fix:`以前は「西条発電所の連系線」として、西条発電所の手前の点（OSM の線の端）から西条変電所までを描いていた。一覧の No.17 に対応付けて線名を直し、端を西条火力変電所の区画まで延ばした${OWNER}。ID は残した。`,
   why:['両端は一次資料（系統図・一覧）で西条火力変電所〜西条変電所と分かるが、西条火力変電所は名前のない地図データの区画に名前を当てたもので、経路は OSM の名前のない線分だけで描いた参考表示。','No.17 の端点は一次資料。経路は OSM の名前のない線分（C区分）。']});}
 // No.27 讃岐坂出線：坂出火力 → 讃岐（以前の「讃岐坂出線（推定）」の ID、西回りの way 87538343 の全体）
 const SAKAIDE_END='変31 坂出火力変電所は区画が地図データになく、坂出火力発電所の構内にあるとみなした（推定）。線の坂出側の端は、以前の「坂出火力発電所の連系線」と同じ OSM の線の端（node 1188997031）。';
 const kagawaOld=line('shikoku-187-香川線'),infer=line('ledger-infer-shikoku-187-102958892'),sk=line('shikoku-plant-187-way-605687599');
 if(infer.name!=='讃岐坂出線（推定）'||infer.osmIds.join()!=='102958892,1104430578,102958918,1104430576,1104430577,102958890')throw Error('讃岐坂出線：以前の線が想定と違う');
 if(kagawaOld.osmIds.join()!=='987107164,87538343,88161482'||kagawaOld.connections[0].node!==1820235735)throw Error('香川線：以前の線が想定と違う');
 if(sk.name!=='坂出火力発電所の連系線'||sk.osmIds.join()!=='87538343'||sk.connections[0].node!==1188997031)throw Error('坂出火力線：以前の線が想定と違う');
 const sakaideConn=structuredClone(sk.connections[0]);
 {const c=chain('讃岐坂出線',1188997031,[{way:87538343,to:1027859562},{way:987107164,to:1820235735}]);
  made.push({id:infer.id,old:infer,oldName:infer.name,name:'讃岐坂出線',c,from:structuredClone(sakaideConn),to:structuredClone(kagawaOld.connections[0]),
   row:'No.27「讃岐坂出線」187kV、2回線、潮流正方向 変31→変4（No.27・No.28 の予想潮流 1,434MW は2線を合わせた一覧の想定値で、実績ではない。潮流は表示しない）。',
   ends:'坂出側の端点（変31 坂出火力変電所）は、地図データに区画がないので坂出火力発電所の構内とみなした（推定）。',map:`変31＝坂出火力変電所、変4＝讃岐変電所。${SAKAIDE_END}`,
   kind:'坂出火力変電所（坂出火力発電所の構内）と讃岐変電所を結ぶ 187kV・2回線の線。坂出側の約8.5km は坂出火力線と同じ OSM の線（共用区間）。',
   geo:geo(c.ids,'坂出火力発電所から讃岐変電所までの OSM の 2回線の線（way 87538343、約27km）の全体と、讃岐変電所の引込（way 987107164）。途中の node 1029368779 で坂出火力線が香川変電所へ分かれる。'),
   fix:`以前は「讃岐坂出線（推定）」として、一覧の端点の記号から推定し、東回りの OSM の線（約${km(infer.paths).toFixed(1)}km）を描いていた。その経路は香川線（No.29）なので香川線へ移し、この線は西回りの way 87538343 に直した${OWNER}。ID は残した。`,
   why:['両端は一次資料（系統図・一覧）で坂出火力変電所〜讃岐変電所と分かるが、坂出火力変電所は発電所の構内とみなした（推定）もので、経路は OSM の名前のない線分だけで描いた参考表示。','No.27 の端点は一次資料。坂出側の端は坂出火力発電所の構内とみなした（推定）。経路は OSM の名前のない線分（C区分）。']});}
 // No.28 坂出火力線：坂出火力 → 分かれ目 → 香川（以前の「坂出火力発電所の連系線」の ID）
 {const c=chain('坂出火力線',1188997031,[{way:87538343,to:1029368779},{way:88161482}]);endIn('坂出火力線',c.paths.at(-1).at(-1),{rings:rings('way',87491654).rs,name:'香川変電所'});
  made.push({id:sk.id,old:sk,oldName:sk.name,name:'坂出火力線',c,from:structuredClone(sakaideConn),to:conn(c.end,c.paths.at(-1).at(-1),kagawa),
   row:'No.28「坂出火力線」187kV、2回線、潮流正方向 変31→変28（予想潮流は No.27 と合わせた一覧の想定値で、実績ではない。潮流は表示しない）。',
   ends:'坂出側の端点（変31 坂出火力変電所）は、地図データに区画がないので坂出火力発電所の構内とみなした（推定）。',map:`変31＝坂出火力変電所、変28＝香川変電所。${SAKAIDE_END}`,
   kind:'坂出火力変電所（坂出火力発電所の構内）と香川変電所を結ぶ 187kV・2回線の線。坂出側の約8.5km は讃岐坂出線と同じ OSM の線（共用区間）。',
   geo:geo(c.ids,'坂出側は way 87538343 の北側（node 1029368779 まで、讃岐坂出線と共用）、そこから香川変電所まで way 88161482。'),
   fix:`以前は「坂出火力発電所の連系線」として、坂出火力発電所から OSM の線の分かれ目（node 1029368779）までを描いていた。一覧の No.28 に対応付けて線名を直し、香川変電所まで延ばした${OWNER}。ID は残した。`,
   why:['両端は一次資料（系統図・一覧）で坂出火力変電所〜香川変電所と分かるが、坂出火力変電所は発電所の構内とみなした（推定）もので、経路は OSM の名前のない線分だけで描いた参考表示。','No.28 の端点は一次資料。坂出側の端は坂出火力発電所の構内とみなした（推定）。経路は OSM の名前のない線分（C区分）。']});}
 // No.29 香川線（OCCTO の区間・潮流はそのまま）：経路を東回りに付け替える。讃岐側の約4.7km は讃岐鳴門線と同じ OSM の線（共架）
 {const sn=line('shikoku-187-讃岐鳴門線'),sEnd=sn.connections.find(x=>x.node===1018364186);if(!sEnd)throw Error('香川線：讃岐鳴門線の讃岐側の端が変わった');
  const c=chain('香川線',1018364186,[{way:102958862,to:1188994186},{way:102958892},{way:1104430578},{way:102958918},{way:1104430576,to:10106482628},{way:1104430577,to:1188992439},{way:102958890}]);
  endIn('香川線',c.paths.at(-1).at(-1),{rings:rings('way',87491654).rs,name:'香川変電所'});
  const oldKm=km(kagawaOld.paths);kagawaOld.osmIds=c.ids;kagawaOld.paths=c.paths;
  const kcab=c.ids.filter(i=>W.get(i)?.tags?.power==='cable');if(kcab.length)kagawaOld.cableOsmIds=kcab;else delete kagawaOld.cableOsmIds;
  kagawaOld.connections=[structuredClone(sEnd),conn(c.end,c.paths.at(-1).at(-1),kagawa)];
  set(kagawaOld,'地理参照',`OSM ${c.ids.length}線分（計約${km(c.paths).toFixed(1)}km）。讃岐変電所から約4.7kmは讃岐鳴門線と同じ OSM の線（way 102958862、2回線の登録）を共架として通り、node 1188994186 で北へ分かれて香川変電所まで（way 102958892 ほか）。${PHOTO}と国土地理院の送電線記号（ズーム16、2026-11-10取得）では、この区間に並行する別の線はなく、鉄塔の列は1つで、共架として描いた。個別回線・母線は未確認。`);
  set(kagawaOld,'経路の訂正（2026-11-10）',`${MAP2}で No.29 香川線は変4（讃岐）→変28（香川）、No.27 讃岐坂出線は変31→変4、No.28 坂出火力線は変31→変28。以前は西回り（way 87538343 の讃岐〜分かれ目と way 88161482、約${oldKm.toFixed(1)}km）を香川線として描いていたが、それは讃岐坂出線と坂出火力線の経路なので、東回り（以前の「讃岐坂出線（推定）」の経路）に付け替えた${OWNER}。ID・両端・OCCTO の潮流の割り当ては変えていない。`);
  set(kagawaOld,'出典',`OCCTO系統情報サービス（四国、2026-10-01の実績・容量）。${MAP2}。地理はOSM（${osmAt}時点 data/raw/shikoku-osm）。`);}
 // 鳴門淡路線：鳴門変電所 → 西淡変電所（187kV、関西電力送配電）
 {const sn=line('shikoku-187-讃岐鳴門線'),nEnd=sn.connections.find(x=>x.node===9123574697);if(!nEnd)throw Error('鳴門淡路線：讃岐鳴門線の鳴門側の端が変わった');
  const c=chain('鳴門淡路線',9123574697,[{way:987053939},{way:987053945},{way:722498910},{way:486490194},{way:1037463535},{way:1037463534},{way:1037463533},{way:724287149},{way:1037463526}]);
  endIn('鳴門淡路線',c.paths.at(-1).at(-1),F.seidan);
  const cable=[1037463535,1037463534,1037463533];for(const id of cable){const t=W.get(id).tags;if(t.power!=='cable'||t.location!=='underground')throw Error('鳴門淡路線：way '+id+' が地中でない');}
  made.push({id:'shikoku-187-鳴門淡路線',name:'鳴門淡路線',c,cable,from:structuredClone(nEnd),to:conn(c.end,c.paths.at(-1).at(-1),F.seidan),
   row:`${MAP2}の系統図で、鳴門変電所（No.9）から「関西エリア 西淡（変）」へ向かう矢印（線番号・線名なし。送電線の一覧に行はない）。線名「鳴門淡路線」・187kV・関西電力送配電の設備はオーナー指示（2026-11-10）による。`,
   map:'鳴門側は変電所一覧の No.9 鳴門変電所。西淡側は、矢印の先の「西淡（変）」を、OSM の線が行き着く淡路島の 187;77kV の名前のない変電所の区画とみなした（推定）。',
   kind:'鳴門変電所と西淡変電所（関西エリア）を結ぶ 187kV の線（関西電力送配電の設備）。OCCTO の地域間連系線（四国〜関西は阿南紀北直流幹線）には含まれない線として、四国の地図データに載せる。',
   geo:geo(c.ids,`鳴門変電所の引出し約1.1km（way 987053939・987053945。OSM の回線数の登録は4）は讃岐鳴門線と同じ OSM の線。淡路側の way 1037463535・1037463534・1037463533（約5.7km）は OSM で地中ケーブル（power=cable、location=underground）なので点線で描く。西淡側の端の way 724287149 は OSM で 187;77kV の共架（回線数の登録は4）。回線数は一次資料になく、表示しない。`),
   why:['両端は一次資料（四国電力送配電の系統図の矢印）で鳴門変電所〜西淡変電所と分かるが、線名は一次資料になく（オーナー指示）、西淡変電所は名前のない地図データの区画に名前を当てたもので、経路は OSM の名前のない線分だけで描いた参考表示。','端点は一次資料の系統図の矢印による。線名はオーナー指示、西淡変電所の区画への対応は推定。経路は OSM の名前のない線分（C区分）。'],operator:'関西電力送配電'});}
 // 線を組む・直す
 const ids=[];
 for(const m of made){const attrs=[{label:'公表の行',value:`${m.row.startsWith(MAP2)?'':MAP2+'：'}${m.row}`},{label:'公表区間との対応',value:m.map},...(m.ends?[{label:'端点の根拠',value:m.ends}]:[]),...(m.operator?[{label:'事業者',value:m.operator}]:[]),{label:'区分',value:m.kind},...(m.fix?[{label:`経路・名前の訂正（2026-11-10）`,value:m.fix}]:[]),{label:'地理参照',value:m.geo},{label:'出典',value:`${MAP2}。${m.geo.includes('国土地理院')&&!m.c.ids.some(i=>i>0)?GSI+'。':'地理はOSM（data/raw/shikoku-osm '+osmAt+'時点）。'}`}];
  const l=m.old??{id:m.id,assetId:m.id};
  Object.assign(l,{name:m.name,named:true,voltageKV:187,currentType:'ac',osmIds:m.c.ids,paths:m.c.paths,connections:[m.from,m.to],referenceReview:{status:'partial',endpoints:`${m.from.facilities[0]?.name??'分岐点'}―${m.to.facilities[0]?.name??'分岐点'}`},attributes:attrs});
  delete l.statusConfirmed;delete l.statusCheck;delete l.schematic;delete l.schematicParts;delete l.sourceOsmIds;
  const cab=m.c.ids.filter(i=>W.get(i)?.tags?.power==='cable');if(m.cable&&m.cable.join()!==cab.join())throw Error(m.name+'：地中の線分が想定と違う');
  if(cab.length)l.cableOsmIds=cab;else delete l.cableOsmIds;
  if(!m.old){if(lines.some(x=>x.id===m.id||x.name===m.name))throw Error(m.name+'：同じ ID・名前の線が既にある');lines.push(l);}
  ids.push([l.id,m.why]);}
 // 共架（2026-11-10 オーナー承認 保留108）：香川線・鳴門淡路線は讃岐鳴門線と同じ鉄塔を通ってから分かれる別の線で、讃岐鳴門線の分岐ではない。
 // src/flow-path.ts の flowBranches が讃岐鳴門線の OCCTO の行の「分岐」に数えないよう、線ID で印を付ける
 {const sn=line('shikoku-187-讃岐鳴門線');
  const CO={'shikoku-187-香川線':`讃岐変電所から約4.7km、讃岐鳴門線と同じ鉄塔に載り、node 1188994186 で北へ分かれる別の線で、讃岐鳴門線の分岐ではない。分岐ではないことは一次資料による（${MAP2}で香川線は No.29 変4→変28、讃岐鳴門線は No.32 変4→送32 No.69→変9 で、端点が別）。同じ鉄塔に載ることは補助資料（国土地理院の送電線記号 z16 と${PHOTO}で鉄塔の列が1つ、OSM で同じ線 way 102958862）だけによるもので、一次資料では未確認。`,
   'shikoku-187-鳴門淡路線':`鳴門変電所からの引出し約1.1km、讃岐鳴門線と同じ鉄塔に載り、node 6777087717 で北東へ分かれる別の線で、讃岐鳴門線の分岐ではない。分岐ではないことは一次資料による（${MAP2}の系統図で、鳴門淡路線は鳴門変電所から西淡（変）への矢印、讃岐鳴門線は No.32 で、どちらも鳴門変電所が端）。同じ鉄塔に載ることは補助資料（OSM で1本の線 way 987053945、回線数の登録は4）だけによるもので、一次資料では未確認。`};
  for(const [id,text] of Object.entries(CO)){const l=line(id);if(!l.osmIds.some(i=>sn.osmIds.includes(i)))throw Error(l.name+'：讃岐鳴門線と共用する OSM の線がない（共架の前提が変わった）');l.coHungWith=[sn.id];set(l,'共架',text);}}
 // 新改幹線・新改高知線：端を新改発電所 → 新改変電所（一覧の変14）。いまの端は変電所の区画の数m外なので、OSM の引込（1径間）を足して区画の内側まで延ばす
 const BAY={'shikoku-187-新改幹線':[7388075550,1023830351],'shikoku-187-新改高知線':[7388075549,1023830349]};
 for(const [id,[node,bay]] of Object.entries(BAY)){const l=line(id),k=l.connections.findIndex(c=>c.facilities.some(f=>f.id===shinkaiPS.id)),e=l.connections[k];if(!e||e.node!==node)throw Error(id+'：新改発電所の端が想定と違う');
  if(inArea(e.position,F.shinkai))throw Error(id+'：端が既に新改変電所の区画の内側（引込を足す前提が変わった）');
  const c=chain(id,node,[{way:bay}]),p=c.paths[0];if(!inArea(p.at(-1),F.shinkai)||km([p])>0.1)throw Error(id+'：引込が想定と違う');
  if(k===0){l.paths.unshift([...p].reverse());l.osmIds.unshift(bay);}else{l.paths.push(p);l.osmIds.push(bay);}
  l.connections[k]=conn(c.end,p.at(-1),F.shinkai);l.referenceReview={...l.referenceReview,endpoints:l.referenceReview?.endpoints?.replace('新改発電所','新改変電所')};
  set(l,'端点の根拠（2026-11-10）',`OCCTO の区間の端点「新改PS」を、${MAP2}の No.22 新改高知線（変14→変13）・No.23 新改幹線（変14→変12）の変14 新改変電所（187/66kV）に当てた。以前は隣の新改発電所（9,300kW の水力）を端にしていた。線の端は、OSM の引込（way ${bay}、1径間）を足して新改変電所の区画の内側にした${OWNER}。`);}
 // 線の端でなくなった発電所の「系統との接続」
 set(shinkaiPS,'系統との接続','新改変電所（187/66kV）の隣の発電所。新改変電所に直接つながるとみなした（推測。接続の電圧・経路は未確認）。送電線は描かない。');
 set(saijoPS,'系統との接続','西条火力変電所（187/66kV）がある構内の発電所。西条火力変電所に直接つながるとみなした（推測。号機ごとの接続は未確認）。送電線は描かない。');
 futamata.attributes=futamata.attributes.filter(a=>a.label!=='系統との接続');set(futamata,'接続する線（2026-11-10）','二又線（No.43）で奈半利川変電所に、魚梁瀬線（No.44）で魚梁瀬発電所につながる（一次資料の系統図。発電所番号 <32> を二又とみなしたのは推定）。');
 return ids;
}
// applyTiers は「公表の行」のある線を C とし、定型の理由を付ける。実際の理由に差し替える（C のまま）
export function overrideNahariTiers(lines,ids){
 for(const [id,[note,why]] of ids){const l=lines.find(x=>x.id===id);const at=label=>l.attributes.findIndex(a=>a.label===label);
  if(l.attributes[at('照合区分')]?.value!=='C区分')throw Error(l.name+'：照合区分が C でない');
  const i=at('要注意（C区分）'),j=at('照合の根拠');if(i<0||j<0)throw Error(l.name+'：要注意・照合の根拠がない');
  l.attributes[i]={label:'要注意（C区分）',value:note};l.attributes[j]={label:'照合の根拠',value:why};}
}
