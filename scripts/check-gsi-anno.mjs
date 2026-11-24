// 設備の名称・位置を国土地理院の地図注記（experimental_anno z15、電子国土基本図の注記）で確かめる。原本は data/raw/gsi-anno/ に保存（出典：国土地理院）。
// 結果 docs/research/gsi-facility-check.json を scripts/assign-tiers.mjs が読む（一致した設備は要注意を外し、線の判定で所在地推定として扱わない）。2026-10-03
import fs from 'node:fs';
const z=15,tile=(lat,lon)=>{const n=2**z;return [Math.floor((lon+180)/360*n),Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n)];};
const dist=(a,b)=>{const t=Math.PI/180;return 6371000*Math.hypot((b[1]-a[1])*t*Math.cos(a[0]*t),(b[0]-a[0])*t)};
async function anno(x,y){const f=`data/raw/gsi-anno/${z}-${x}-${y}.geojson`;if(fs.existsSync(f))return JSON.parse(fs.readFileSync(f,'utf8'));
 const r=await fetch(`https://cyberjapandata.gsi.go.jp/xyz/experimental_anno/${z}/${x}/${y}.geojson`,{headers:{'User-Agent':'powerflow-site research'}});const t=r.ok?await r.text():'{"type":"FeatureCollection","features":[]}';fs.writeFileSync(f,t);await new Promise(r=>setTimeout(r,300));return JSON.parse(t);}
const seen=new Set(),out=[];
for(const r of ['chubu','hokuriku','kansai','chugoku','shikoku','kyushu']){const d=JSON.parse(fs.readFileSync(`public/data/${r}-trunk.json`,'utf8'));
 for(const f of d.facilities){if(seen.has(f.id))continue;seen.add(f.id);
  const [x,y]=tile(...f.position);const feats=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1])feats.push(...(await anno(x+dx,y+dy)).features);
  const stem=f.name.replace(/(変電所|開閉所|変換所|連系所|発電所|火力発電所|原子力発電所)$/,'');
  const hits=feats.filter(a=>/変電所|開閉所|変換所|発電所|電力所/.test(a.properties.knj)).map(a=>({knj:a.properties.knj,ctg:a.properties.annoCtg,m:Math.round(dist(f.position,[a.geometry.coordinates[1],a.geometry.coordinates[0]]))})).filter(h=>h.m<1500).sort((a,b)=>a.m-b.m);
  out.push({region:r,id:f.id,name:f.name,assigned:!!f.attributes?.some(a=>a.label==='名称・位置の根拠'),match:hits.find(h=>h.knj.replace(/^(.*電力(株式会社)?|.*送配電|電源開発)/,'').replace(/(火力|原子力|水力)?(変電所|開閉所|変換所|連系所|発電所|電力所)$/,'')===stem.replace(/(火力|原子力|水力)$/,''))??null,near:hits.slice(0,3)});}}
fs.writeFileSync('docs/research/gsi-facility-check.json',JSON.stringify({source:'国土地理院 地図注記（https://cyberjapandata.gsi.go.jp/xyz/experimental_anno/15/{x}/{y}.geojson）',rule:'設備の中心から1500m以内（周囲3×3タイル）の注記で、会社名と設備種別の語尾を除いた名前が設備名の語幹と一致するもの',retrievedAt:new Date().toISOString(),facilities:out},null,1)+'\n');
const a=out.filter(o=>o.assigned);console.log('assigned',a.length,'matched',a.filter(o=>o.match).length,'| all',out.length,'matched',out.filter(o=>o.match).length);
for(const o of a)console.log(o.region,o.name,o.match?'✔ '+o.match.knj+' '+o.match.m+'m':'✘',JSON.stringify(o.near.map(h=>h.knj+' '+h.m)));
