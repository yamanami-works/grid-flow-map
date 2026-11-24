import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {labelNames,labelName,placeLabels,labelPriority,labelOrder,MARKER_SIZE,type LabelInput,type Box} from '../src/facility-labels.ts';
// 2026-11-22 設備名のラベル（回答「後ろにつく変電所や発電所などの共通の言葉は記載せずに、頭の名前だけ表示するようにして。あとは推奨で」）
const w=(t:string)=>t.length*12;const view:Box={l:0,t:0,r:800,b:600};
const hit=(a:Box,b:Box)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
test('ラベルの名前：末尾の種類の語を除いた頭の名前',()=>{
 assert.equal(labelName('世田谷変電所'),'世田谷');assert.equal(labelName('碧南火力発電所'),'碧南');assert.equal(labelName('浜岡原子力発電所'),'浜岡');
 assert.equal(labelName('知多第二火力発電所'),'知多第二');assert.equal(labelName('新信濃変電所'),'新信濃');assert.equal(labelName('西群馬開閉所'),'西群馬');assert.equal(labelName('西条火力変電所'),'西条火力','発電方式の語は発電所の前だけ除く');
 assert.equal(labelName('芽登第二発電所（推定）'),'芽登第二（推定）','括弧書きは残す');
 assert.equal(labelName('袖ヶ浦火力発電所側の開閉所（OSM無名）'),'袖ヶ浦火力発電所側の開閉所（OSM無名）','「の」で終わる頭は元のまま');
 assert.equal(labelName('変電所'),'変電所','空になるときは元のまま');
 assert.equal(labelName('もんじゅ'),'もんじゅ');assert.equal(labelName('新信濃変換所'),'新信濃');assert.equal(labelName('南福光連系所'),'南福光');assert.equal(labelName('勇払バイオマス発電'),'勇払バイオマス発電','発電所で終わらない名前は元のまま');assert.equal(labelName('需要家'),'需要家');
});
test('重ならない・画面の外と除く範囲には出さない・同じ入力なら同じ結果',()=>{
 const items:LabelInput[]=[];for(let i=0;i<60;i++)items.push({id:'f'+i,text:'名前'+i,x:100+(i%10)*40,y:100+Math.floor(i/10)*20,markerWidth:MARKER_SIZE,priority:i%3});
 items.push({id:'out',text:'外',x:-10,y:50,markerWidth:22,priority:0});
 const blocked=[{l:700,t:0,r:800,b:600}];
 const a=placeLabels(items,w,view,blocked),b=placeLabels([...items].reverse(),w,view,blocked);
 assert.deepEqual(a,b,'同じ結果');
 assert.ok(a.length>0&&a.length<items.length);assert.ok(!a.some(p=>p.id==='out'));
 const boxes=a.map(p=>({l:p.x,t:p.y,r:p.x+p.width,b:p.y+16}));
 for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].l>=0&&boxes[i].r<=800&&boxes[i].t>=0&&boxes[i].b<=600);assert.ok(!hit(boxes[i],blocked[0]));
  for(const m of items)assert.ok(!hit(boxes[i],{l:m.x-m.markerWidth/2,t:m.y-11,r:m.x+m.markerWidth/2,b:m.y+11}),'印と重ならない');
  for(let j=i+1;j<boxes.length;j++)assert.ok(!hit(boxes[i],boxes[j]),'ラベル同士が重ならない');}
});
test('優先順：選択中＞変換所＞電圧の高い順＞発電所・需要家。同じなら名前・id の順。重なれば優先の高い方が出る',()=>{
 const f=(id:string,kind:string,v:number[])=>({id,name:id,kind,voltages:v,position:[0,0] as [number,number]});
 const p=[labelPriority(f('s','substation',[154]),'s'),labelPriority(f('c','converter',[]),null),labelPriority(f('a','substation',[500]),null),labelPriority(f('b','switchyard',[275]),null),labelPriority(f('p','plant',[500]),null)];
 for(let i=1;i<p.length;i++)assert.ok(p[i-1]<p[i],String(i));
 assert.deepEqual(labelOrder([{id:'2',text:'b',x:0,y:0,markerWidth:22,priority:1},{id:'1',text:'b',x:0,y:0,markerWidth:22,priority:1},{id:'3',text:'a',x:0,y:0,markerWidth:22,priority:1}]).map(x=>x.id),['3','1','2']);
 // 同じ場所の2つ：優先の高い方だけが右に出る（もう片方は左に回る）
 const two=placeLabels([{id:'lo',text:'低い',x:400,y:300,markerWidth:22,priority:9},{id:'hi',text:'高い',x:400,y:300,markerWidth:22,priority:1}],w,view);
 assert.equal(two[0].id,'hi');assert.ok(two[0].x>400);
});
test('複数の役割の設備は印の幅（22px×役割数）で避ける',()=>{
 const one=placeLabels([{id:'m',text:'新信濃',x:400,y:300,markerWidth:66,priority:1}],w,view);
 assert.ok(one[0].x>=400+33,'右のラベルは印の右端より外');
});
test('組み込み：需要家も表示名（name）だけを使う、試行画面では消す、地図のボタンなどの下に置かない',()=>{
 const real=readFileSync('src/real.ts','utf8'),lab=readFileSync('src/facility-labels.ts','utf8');
 assert.ok(/text: \(this\.names\.get\(f\.id\) \?\? labelName\(f\.name\)\)/.test(lab)&&/out\.set\(f\.id, labelName\(f\.name, true\)\)/.test(lab)&&!/customer\??\./.test(lab),'表示名だけ');
 assert.ok(real.includes("if(pilot?.active){facilityLabels.clear();return;}"));
 assert.ok(real.includes('facilityLabels.update([...want.values()],selectedId,true);'));
 assert.ok(/new FacilityLabels\(map,'[^']*\.map-top[^']*\.map-controls[^']*#map-flow-key[^']*#real-time[^']*#detail/.test(real));
 assert.ok(lab.includes("LABEL_MIN_ZOOM = 10")&&lab.includes("zIndex = '610'")&&lab.includes("pointerEvents = 'none'"));
});
test('配信データの設備名：短くした名前が空にならない',()=>{
 for(const f of readdirSync('public/data').filter(x=>x.endsWith('-trunk.json'))){for(const x of JSON.parse(readFileSync('public/data/'+f,'utf8')).facilities??[])assert.ok(labelName(x.name).length>0,x.name);}
});
test('発電所どうしで同じ名前になるときだけ発電方式の語を残す',()=>{
 const n=labelNames([{id:'a',name:'敦賀火力発電所',kind:'plant'},{id:'b',name:'敦賀原子力発電所',kind:'plant'},{id:'c',name:'橘湾火力発電所',kind:'plant'},{id:'d',name:'橘湾発電所',kind:'plant'},{id:'e',name:'東海変電所',kind:'substation'},{id:'f',name:'東海発電所',kind:'plant'},{id:'g',name:'碧南火力発電所',kind:'plant'}]);
 assert.equal(n.get('a'),'敦賀火力');assert.equal(n.get('b'),'敦賀原子力');assert.equal(n.get('c'),'橘湾火力');assert.equal(n.get('d'),'橘湾');
 assert.equal(n.get('e'),'東海');assert.equal(n.get('f'),'東海','変電所と発電所の組はそのまま');assert.equal(n.get('g'),'碧南');
});
