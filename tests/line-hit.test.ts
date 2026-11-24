import test from 'node:test';
import assert from 'node:assert/strict';
import {lineHits,hitWidth,TapGesture,type HitLine} from '../src/line-hit.ts';
import {lineWidth} from '../src/line-style.ts';
const xy=(x:number,y:number)=>({x,y});
const line=(id='a',width=6,paths=[[xy(0,0),xy(100,0)]]):HitLine=>({id,label:id,width,paths});
test('voltage-specific CSS-pixel corridor covers full length and exact boundaries',()=>{
 for(const [kv,w]of [[500,6],[275,3.5],[250,2.8],[154,2.8],[66,2]]){
  const radius=w*(kv===66?5:3)/2; const target={...line('a',w),voltageKV:kv};
  assert.equal(lineWidth(kv),w);assert.equal(hitWidth(w,kv),radius*2);
  for(const x of [0,1,25,50,75,99,100]){
   assert.equal(lineHits(xy(x,radius),[target]).length,1);
   assert.equal(lineHits(xy(x,radius+.01),[target]).length,0);
  }
 }
});
test('bends and shared fine segments are continuous; rectangles and geographic gaps are not hits',()=>{
 const bend=line('b',2,[[xy(0,0),xy(0,10),xy(10,10)]]);
 assert.equal(lineHits(xy(2,9),[bend]).length,1);
 assert.equal(lineHits(xy(5,5),[bend]).length,0);
 const split=line('s',2,[[xy(0,0),xy(10,0)],[xy(10,0),xy(20,0)],[xy(40,0),xy(50,0)]]);
 assert.equal(lineHits(xy(10,3),[split]).length,1);
 assert.equal(lineHits(xy(30,0),[split]).length,0);
});
test('nearest line wins independently of order; indistinguishable crossing gets candidates; hidden absent',()=>{
 const a=line(),b=line('b',6,[[xy(0,8),xy(100,8)]]);
 assert.deepEqual(lineHits(xy(50,1),[a,b]).map(h=>h.id),['a']);
 assert.deepEqual(lineHits(xy(50,1),[b,a]).map(h=>h.id),['a']);
 assert.deepEqual(lineHits(xy(50,4),[a,b]).map(h=>h.id),['a','b']);
 assert.equal(lineHits(xy(50,1),[]).length,0);
 const cross=line('c',2,[[xy(50,-50),xy(50,50)]]);
 assert.equal(lineHits(xy(50,0),[a,cross]).length,2);
});
test('flow, selected casing and zoom geography never enter the CSS-pixel hit-width calculation',()=>{
 for(const flow of [100,0,null,undefined])for(const selected of [false,true])for(const scale of [0.1,1,10]){
  const l={...line('a',3.5,[[xy(0,0),xy(100*scale,0)]]),flow,selected};
  assert.equal(lineHits(xy(5*scale,5.25),[l]).length,1);assert.equal(lineHits(xy(5*scale,5.26),[l]).length,0);
 }
});
test('drag/pinch/cancel suppress click, but next genuine tap is accepted',()=>{
 const g=new TapGesture();g.down(1,xy(0,0));g.move(1,xy(4,0));g.up(1);assert.ok(g.blocked);
 g.down(1,xy(0,0));g.up(1);assert.equal(g.blocked,false);
 g.down(1,xy(0,0));g.down(2,xy(1,1));g.up(2);g.up(1);assert.ok(g.blocked);
 g.down(1,xy(0,0));g.cancel(1);assert.ok(g.blocked);
 g.down(1,xy(0,0));g.move(1,xy(1,1));g.up(1);assert.equal(g.blocked,false);
});

 test("only explicit 66kV gets 5W, not other lines sharing a 2px stroke",()=>{assert.equal(hitWidth(2,66),10);assert.equal(hitWidth(2,33),6);assert.equal(hitWidth(2),6);});
