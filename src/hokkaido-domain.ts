import type {RegionalSnapshot} from './regions.ts';
import {alignCapacities} from './capacity-aliases.ts';
// Scope aliases to reviewed line, voltage and complete ordered endpoints.
// Keep OCCTO IDs and observations unchanged; never join by row order.
export function reviewedHokkaidoDay<T extends RegionalSnapshot>(input:T):T {
 // 分母に使わない容量の行に excluded を付ける（src/capacity-aliases.ts。「（他社）」の行など、2026-10-10）
 const day=alignCapacities('hokkaido',input);
 const pair=(r:{name:string;voltageKV:number;from:string;to:string},capacity=false)=>{
  if(r.name==='北斗幹線'&&r.voltageKV===275&&r.from==='北斗変換所'&&r.to==='大野変電所')return r;
  if(r.name==='大野線'&&r.voltageKV===187){
   if(!capacity&&r.from==='北七飯SS'&&r.to==='大野SS')return {...r,from:'北七飯変電所',to:'大野変電所'};
   if(capacity&&r.from==='大野変電所'&&r.to==='北七飯変電所')return r;
  }
  if(r.name==='北本七飯線'&&r.voltageKV===187){
   if(!capacity&&r.from==='北七飯SS'&&r.to==='函館変換所')return {...r,from:'北七飯変電所'};
   if(capacity&&r.from==='電発函館変換所'&&r.to==='北七飯変電所')return {...r,from:'函館変換所'};
  }
  if(r.name==='道南幹線'&&r.voltageKV===275){
   if(!capacity&&r.from==='西双葉SWS'&&r.to==='北斗CS')return {...r,from:'西双葉開閉所',to:'北斗変換所'};
   if(capacity&&r.from==='西双葉開閉所'&&r.to==='北斗変換所')return r;
  }
  if(r.name==='道央南幹線'&&r.voltageKV===275){
   if(!capacity&&r.from==='西双葉SWS'&&r.to==='南早来SS')return {...r,from:'西双葉開閉所',to:'南早来変電所'};
   if(capacity&&r.from==='南早来変電所'&&r.to==='西双葉開閉所')return r;
  }
  const central=[
   ['狩勝幹線','北新得SS','南早来SS','北新得変電所','南早来変電所','南早来変電所','北新得変電所'],
   ['道央東幹線','西当別SS','南早来SS','西当別変電所','南早来変電所','南早来変電所','西当別変電所'],
   ['道央北幹線','西当別SS','西野SS','西当別変電所','西野変電所','西当別変電所','西野変電所'],
   ['道央西幹線','西双葉SWS','西野SS','西双葉開閉所','西野変電所','西双葉開閉所','西野変電所'],
  ];
  for(const [name,from,to,geoFrom,geoTo,capFrom,capTo] of central)if(r.name===name&&r.voltageKV===275){
   if(!capacity&&r.from===from&&r.to===to)return {...r,from:geoFrom,to:geoTo};
   if(capacity&&r.from===capFrom&&r.to===capTo)return r;
  }
  if(r.voltageKV===187){
   const north=[
    ['十勝幹線(恵庭南札線)','南札幌SS','恵庭SS','南札幌変電所','恵庭変電所','恵庭南札線','恵庭変電所','南札幌変電所'],
    ['西春別線','西春別SS','東釧路SS','西春別変電所','東釧路変電所','西春別線','東釧路変電所','西春別変電所'],
    ['日勝幹線（新冠SWS～北新得）','北新得SS','新冠SWS','北新得変電所','新冠開閉所','日勝幹線','新冠開閉所','北新得変電所'],
    ['岩松西線','北芽室SS','北新得SS','北芽室変電所','北新得変電所','岩松西線','北新得変電所','北芽室変電所'],
    ['道東幹線','宇円別SS','北新得SS','宇円別変電所','北新得変電所','道東幹線','北新得変電所','宇円別変電所'],
    ['釧路北線','東釧路SS','宇円別SS','東釧路変電所','宇円別変電所','釧路北線','宇円別変電所','東釧路変電所'],
    ['室蘭西幹線（西室蘭～双葉）','双葉SWS','西室蘭SWS','双葉開閉所','西室蘭開閉所','室蘭西幹線','西室蘭開閉所','双葉開閉所'],
    ['室蘭西幹線（西室蘭～室蘭）','西室蘭SWS','室蘭SS','西室蘭開閉所','室蘭変電所','室蘭西幹線','西室蘭開閉所','室蘭変電所'],
    ['双葉幹線','双葉SWS','苫小牧SS','双葉開閉所','苫小牧変電所','双葉幹線','苫小牧変電所','双葉開閉所'],
    ['室蘭東幹線','室蘭SS','苫小牧SS','室蘭変電所','苫小牧変電所','室蘭東幹線','苫小牧変電所','室蘭変電所'],
    ['苗穂北線','苗穂SS','西当別SS','苗穂変電所','西当別変電所','苗穂北線','西当別変電所','苗穂変電所'],
    ['篠路線','篠路SS','西当別SS','篠路変電所','西当別変電所','篠路線','西当別変電所','篠路変電所'],
    ['西小樽線','西小樽SS','西野SS','西小樽変電所','西野変電所','西小樽線','西野変電所','西小樽変電所'],
    ['旭川幹線','西滝川SS','西旭川SS','西滝川変電所','西旭川変電所','旭川幹線','西滝川変電所','西旭川変電所'],
    ['道北幹線','旭川嵐山SWS','西当別SS','旭川嵐山開閉所','西当別変電所','道北幹線','西当別変電所','旭川嵐山開閉所'],
    ['北幌延線','西中川SS','西名寄SS','西中川変電所','西名寄変電所','北幌延線','西中川変電所','西名寄変電所'],
    ['名寄幹線（旭川嵐山～西名寄）','西名寄SS','旭川嵐山SWS','西名寄変電所','旭川嵐山開閉所','名寄幹線','旭川嵐山開閉所','西名寄変電所'],
    ['名寄幹線（西旭川～旭川嵐山）','西旭川SS','旭川嵐山SWS','西旭川変電所','旭川嵐山開閉所','名寄幹線','西旭川変電所','旭川嵐山開閉所'],
    // 2026-10-01 C区分で追加した保留区間（docs/research/hokkaido-holds-adopted.json）。OSMの経路のみ・要注意。
    ['西札幌線','篠路SS','西札幌SS','篠路変電所','西札幌変電所','西札幌線','篠路変電所','西札幌変電所'],
    ['室蘭西幹線（西野～西札幌）','西札幌SS','西野SS','西札幌変電所','西野変電所','室蘭西幹線','西野変電所','西札幌変電所'],
    ['南九条線','西野SS','南九条SS','西野変電所','南九条変電所','南九条線','西野変電所','南九条変電所'],
    ['追分線','追分SWS','南早来SS','追分開閉所','南早来変電所','追分線','南早来変電所','追分開閉所'],
    ['十勝幹線(追分恵庭線)','恵庭SS','追分SWS','恵庭変電所','追分開閉所','追分恵庭線','追分開閉所','恵庭変電所'],
    ['十勝幹線(新得追分線）','北新得SS','追分SWS','北新得変電所','追分開閉所','新得追分線','北新得変電所','追分開閉所'],
    ['旭川南線','旭川SS','旭川嵐山SWS','旭川変電所','旭川嵐山開閉所','旭川南線','旭川嵐山開閉所','旭川変電所'],
    ['西音更線','西音更SS','北新得SS','西音更変電所','北新得変電所','西音更線','北新得変電所','西音更変電所'],
    ['日高幹線','南早来SS','岩清水SWS','南早来変電所','岩清水開閉所','日高幹線','岩清水開閉所','南早来変電所'],
    ['函館幹線','双葉SWS','北七飯SS','双葉開閉所','北七飯変電所','函館幹線','双葉開閉所','北七飯変電所'],
   ];
   for(const [name,from,to,geoFrom,geoTo,capName,capFrom,capTo] of north){
    if(!capacity&&r.name===name&&r.from===from&&r.to===to)return {...r,from:geoFrom,to:geoTo};
    if(capacity&&r.name===capName&&r.from===capFrom&&r.to===capTo)return {...r,name};
   }
   if(r.name==='南札幌幹線'){
    if(!capacity&&r.from==='北江別SS'&&r.to==='南札幌SS')return {...r,from:'北江別変電所',to:'南札幌変電所'};
    if(capacity&&r.from==='北江別変電所'&&r.to==='南札幌変電所')return r;
   }
   if(r.name==='北江別線'){
    if(!capacity&&r.from==='北江別SS'&&r.to==='西当別SS')return {...r,from:'北江別変電所',to:'西当別変電所'};
    if(capacity&&r.from==='西当別変電所'&&r.to==='北江別変電所')return r;
   }
   if(!capacity&&r.name==='室蘭西幹線（西野～双葉）'&&r.from==='双葉SWS'&&r.to==='西野SS')return {...r,from:'双葉開閉所',to:'西野変電所'};
   // Add the reviewed section label only after matching the complete capacity endpoints.
   if(capacity&&r.name==='室蘭西幹線'&&r.from==='双葉開閉所'&&r.to==='西野変電所')return {...r,name:'室蘭西幹線（西野～双葉）'};
  }
  return null;
 };
 return {...day,actual:{...day.actual,lines:day.actual.lines.flatMap(r=>{const ends=pair(r);return ends?[{...r,from:ends.from,to:ends.to,note:'OCCTO公表区間と地理参照経路を照合。個別回線・母線実結線は未確認。'}]:[];})},capacities:day.capacities.flatMap(r=>{const ends=pair(r,true);return ends?[{...r,name:ends.name,from:ends.from,to:ends.to}]:[];})};
}
