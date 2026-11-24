import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPreviewServer} from '../scripts/preview-server.mjs';
test('preview rejects unauthorized requests, hidden files, CSRF and brute force',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-security-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));
 await writeFile(join(root,'data/catalog.json'),JSON.stringify({datasets:[]}));await writeFile(join(root,'index.html'),'OK');
 await writeFile(join(root,'data/secret.json.previous'),'MUST NOT LEAK');
 const server=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,loginLimit:8});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const get=(path,headers={})=>fetch(base+path,{headers,redirect:'manual'});
 assert.equal((await get('/data/catalog.json')).status,401);
 const login=await get('/');const page=await login.text();const csrf=/name="csrf" value="([a-f0-9]+)"/.exec(page)[1];
 assert.match(login.headers.get('content-security-policy'),/script-src 'self'/);
 assert.equal(login.headers.get('referrer-policy'),'same-origin');
 const opaque=await fetch(base+'/login',{method:'POST',headers:{Origin:'null'}});
 assert.equal(opaque.status,403);assert.match(opaque.headers.get('content-type'),/^text\/html/);
 const post=fields=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),redirect:'manual'});
 assert.equal((await post({username:'grid',password:'test-only'})).status,403);
 const success=await post({username:'grid',password:'test-only',csrf});assert.equal(success.status,200);
 assert.match(success.headers.get('content-type'),/^text\/html/);assert.match(await success.text(),/href="\/"/);
 const cookie=success.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const headers={cookie:cookie.split(';')[0]};assert.equal((await get('/',headers)).status,200);
 for(const path of ['/data/secret.json.previous','/__research/official.json','/.env','/%2e%2e/package.json','/data/%2e%2e%5cpackage.json'])assert.equal((await get(path,headers)).status,404,path);
 for(const path of ['/api/paid/map','/api/admin/update','/protected/a.json'])assert.equal((await get(path,headers)).status,403);
 const cross=await fetch(base+'/login',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:new URLSearchParams({csrf,username:'grid',password:'test-only'})});assert.equal(cross.status,403);
 for(let i=0;i<8;i++)await post({csrf,username:'grid',password:'wrong'});
 assert.equal((await post({csrf,username:'grid',password:'wrong'})).status,429);
 assert.equal((await get('/',{authorization:'Basic invalid'})).status,429);
 assert.equal((await get('/',headers)).status,200);
});
// 2026-11-24：ログインの失敗回数は接続元（cf-connecting-ip）ごと。失敗だけを数え、成功は何回でも 429 にならない
test('preview counts login failures per source and does not count successes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-security-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));
 await writeFile(join(root,'data/catalog.json'),JSON.stringify({datasets:[]}));await writeFile(join(root,'index.html'),'OK');
 const server=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,loginLimit:4});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const page=await (await fetch(base+'/')).text();const csrf=/name="csrf" value="([a-f0-9]+)"/.exec(page)[1];
 const post=(ip,password)=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':ip},body:new URLSearchParams({csrf,username:'grid',password}),redirect:'manual'});
 for(let i=0;i<4;i++)assert.equal((await post('203.0.113.1','wrong')).status,401);
 assert.equal((await post('203.0.113.1','test-only')).status,429);
 assert.equal((await post('203.0.113.2','test-only')).status,200);
 const basic='Basic '+Buffer.from('grid:test-only').toString('base64');
 for(let i=0;i<10;i++)assert.equal((await fetch(base+'/',{headers:{authorization:basic,'cf-connecting-ip':'203.0.113.3'}})).status,200);
 assert.equal((await fetch(base+'/data/catalog.json',{headers:{'cf-connecting-ip':'203.0.113.4'}})).status,401);
 for(let i=0;i<4;i++)assert.equal((await fetch(base+'/data/catalog.json',{headers:{authorization:'Basic invalid','cf-connecting-ip':'203.0.113.4'}})).status,401);
 assert.equal((await fetch(base+'/',{headers:{authorization:basic,'cf-connecting-ip':'203.0.113.4'}})).status,429);
});
// 2026-11-24：全体の失敗の上限は置かない。多くの接続元が失敗を重ねても、関係のない本人のログインと Basic 認証は通る
const startPreview=async(t,loginLimit)=>{
 const root=await mkdtemp(join(tmpdir(),'grid-security-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));
 await writeFile(join(root,'data/catalog.json'),JSON.stringify({datasets:[]}));await writeFile(join(root,'index.html'),'OK');
 const server=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,loginLimit});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const csrf=/name="csrf" value="([a-f0-9]+)"/.exec(await (await fetch(base+'/')).text())[1];
 return {server,base,csrf};
};
const BASIC='Basic '+Buffer.from('grid:test-only').toString('base64');
const loginAs=(base,csrf,ip,password)=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':ip},body:new URLSearchParams({csrf,username:'grid',password})});
test('preview does not lock out other sources when many sources fail',async t=>{
 const {base,csrf}=await startPreview(t,2);
 const get=ip=>fetch(base+'/data/catalog.json',{headers:{authorization:'Basic invalid','cf-connecting-ip':ip}});
 for(let i=0;i<40;i++)assert.equal((await get(`198.51.100.${i}`)).status,401);
 assert.equal((await get('198.51.100.0')).status,401);
 assert.equal((await get('198.51.100.0')).status,429,'同じ接続元は制限される');
 assert.equal((await fetch(base+'/',{headers:{authorization:BASIC,'cf-connecting-ip':'203.0.113.9'}})).status,200,'B の正しい Basic 認証');
 assert.equal((await loginAs(base,csrf,'203.0.113.9','test-only')).status,200,'B の正しいログイン');
});
test('preview keeps a valid session even with a bad Authorization header from a limited source',async t=>{
 const {base,csrf}=await startPreview(t,2);
 const cookie=(await loginAs(base,csrf,'203.0.113.5','test-only')).headers.get('set-cookie').split(';')[0];
 for(let i=0;i<2;i++)assert.equal((await fetch(base+'/data/catalog.json',{headers:{authorization:'Basic invalid','cf-connecting-ip':'203.0.113.5'}})).status,401);
 assert.equal((await fetch(base+'/',{headers:{authorization:'Basic invalid','cf-connecting-ip':'203.0.113.5'}})).status,429,'Cookie なしは制限される');
 assert.equal((await fetch(base+'/',{headers:{cookie,authorization:'Basic invalid','cf-connecting-ip':'203.0.113.5'}})).status,200,'有効な Cookie があれば通る');
});
test('preview counts in-flight login POSTs so slow parallel bodies cannot exceed the limit',async t=>{
 const {server,base,csrf}=await startPreview(t,3);
 const port=Number(new URL(base).port),body=new URLSearchParams({csrf,username:'grid',password:'wrong'}).toString();
 const reqs=Array.from({length:6},()=>{
  const req=http.request({host:'127.0.0.1',port,path:'/login',method:'POST',agent:false,headers:{'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body),'cf-connecting-ip':'192.0.2.7'}});
  const done=new Promise((res,rej)=>{req.on('response',r=>{r.resume();r.on('end',()=>res(r.statusCode));});req.on('error',rej);});
  req.flushHeaders();return {req,done};
 });
 await new Promise(r=>setTimeout(r,300));
 for(const {req} of reqs)req.end(body);
 const codes=await Promise.all(reqs.map(x=>x.done));
 assert.equal(codes.filter(c=>c===401).length,3,'401 は loginLimit まで：'+codes.join(','));
 assert.equal(codes.filter(c=>c===429).length,3,codes.join(','));
 assert.equal(server.loginInflight(),0,'終了後に処理中が残らない');
});
