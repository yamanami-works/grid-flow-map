// Research-backed updates to the Tohoku trunk geography that the older OSM snapshot does not yet reflect.
// Applied by prepare-foundation.mjs; run directly (`node scripts/tohoku-updates.mjs`) to patch the published file in place.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** Splits 常磐幹線 at 宮城丸森開閉所 into 常磐北幹線 / 常磐南幹線 (docs/research/tohoku-joban-split.json). Idempotent. */
export function applyJobanSplit(g,s){
 if(g.lines.some(l=>l.id===s.north.id))return false;
 const k=g.lines.findIndex(l=>l.id===s.sourceLineId);if(k<0)throw Error('常磐幹線 not found: '+s.sourceLineId);
 const old=g.lines[k];if(old.paths.length!==1||old.osmIds[0]!==s.osmWay)throw Error('常磐幹線 geometry changed; re-check the split');
 const path=old.paths[0],cut=path.findIndex(p=>p[0]===s.junction.position[0]&&p[1]===s.junction.position[1]);
 if(cut<=0||cut>=path.length-1)throw Error('junction node not on 常磐幹線');
 const f={id:s.facility.id,name:s.facility.name,kind:s.facility.kind,position:s.junction.position,voltages:s.facility.voltages,url:s.facility.url,scopeConnected:true,attributes:[
  {label:'運営者',value:'東北電力ネットワーク'},
  {label:'使用開始',value:'2026-05-08 一部使用開始（常磐北幹線・常磐南幹線・新地アクセス線 各1回線）。全10回線は2027年11月予定。'},
  {label:'位置の根拠',value:s.facility.osm},...(s.facility.verified?[{label:'確認（2026-10-01）',value:s.facility.verified}]:[])]};
 const at={node:s.junction.node,position:s.junction.position,status:'facility-area',facilities:[{id:f.id,name:f.name}],neighborWays:[s.shinchiWay],otherVoltages:[],nearest:{id:f.id,name:f.name,meters:0}};
 const attrs=old.attributes.filter(a=>a.label!=='2026年の接続変更・照合状態');
 const make=(side,points,ends,neighbors)=>({...old,id:side.id,name:side.name,paths:[points],
  topology:{scope:'same-name',namedComponents:1,networks:[{id:side.id+'-component-0',osmIds:[s.osmWay],names:[side.name],terminals:ends.map(c=>({node:c.node,position:c.position,nearest:c.nearest}))}]},
  connections:ends,connectedWayIds:[s.osmWay,...neighbors,s.shinchiWay],
  attributes:[...attrs,{label:'区間（2026年の接続変更）',value:`OSM常磐幹線（way ${s.osmWay}）を宮城丸森開閉所の位置（共有ノード ${s.junction.node}）で分割。OCCTO ${side.occto}。開閉所への引込線（約1km）はOSM未反映のため旧ルートのまま。出典：${s.sources[0]}`}]});
 const south=make(s.south,path.slice(0,cut+1),[old.connections[0],at],s.south.neighborWays);
 const north=make(s.north,path.slice(cut),[at,old.connections[1]],s.north.neighborWays);
 for(const l of [south,north])delete l.assetId;
 g.lines.splice(k,1,north,south);
 if(!g.facilities.some(x=>x.id===f.id))g.facilities.push(f);
 // The 新地火力 500kV way ends at the same node: that end now lands in the switchyard.
 const shinchi=g.lines.find(l=>l.osmIds.length===1&&l.osmIds[0]===s.shinchiWay);
 if(shinchi)shinchi.connections=shinchi.connections.map(c=>c.node===s.junction.node?{...c,status:'facility-area',facilities:[{id:f.id,name:f.name}],nearest:{id:f.id,name:f.name,meters:0}}:c);
 return true;
}
/** Adds reviewed section lines (docs/research/tohoku-review-adopted.json) and trims the edges they cover from the per-way base lines, so nothing is drawn twice. Idempotent. */
export function applySectionAdoptions(g,a){
 if(g.lines.some(l=>l.id===a.lines[0]?.id))return false;
 const key=(p,q)=>[p.join(),q.join()].sort().join('|');
 const covered=new Map(a.lines.map(l=>[l.voltageKV,new Set()]));
 for(const l of a.lines)for(const p of l.paths)for(let i=1;i<p.length;i++)covered.get(l.voltageKV).add(key(p[i-1],p[i]));
 const kept=[];
 for(const b of g.lines){const cov=covered.get(b.voltageKV);if(!cov){kept.push(b);continue;}
  const paths=[],osmIds=[];
  b.paths.forEach((p,k)=>{let piece=[p[0]];for(let i=1;i<p.length;i++){if(cov.has(key(p[i-1],p[i]))){if(piece.length>1){paths.push(piece);osmIds.push(b.osmIds[k]);}piece=[p[i]];}else piece.push(p[i]);}if(piece.length>1){paths.push(piece);osmIds.push(b.osmIds[k]);}});
  if(!paths.length)continue;
  if(paths.length!==b.paths.length||paths.some((p,i)=>p.length!==b.paths[i].length))kept.push({...b,paths,osmIds,attributes:[...(b.attributes??[]),{label:'区間の整理（2026-10-01）',value:'公表区間として採用した線と重なる部分を除いた残り。'}]});
  else kept.push(b);}
 g.lines=[...kept,...a.lines];
 for(const f of a.facilities)if(!g.facilities.some(x=>x.id===f.id))g.facilities.push(f);
 return true;
}
export function applyTohokuUpdates(g,root='.'){
 const joban=applyJobanSplit(g,JSON.parse(readFileSync(root+'/docs/research/tohoku-joban-split.json','utf8')));
 let review=false;try{review=applySectionAdoptions(g,JSON.parse(readFileSync(root+'/docs/research/tohoku-review-adopted.json','utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
 return joban||review;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const file='public/data/tohoku-trunk-osm.json',g=JSON.parse(readFileSync(file,'utf8'));
 console.log(applyTohokuUpdates(g)?'常磐幹線を北・南に分割しました':'適用済み');writeFileSync(file,JSON.stringify(g));
}
