// OCCTO 連系線潮流実績（CA01S070、5分値のCSV）を取得して data/raw/occto-tie-<日付>/<連系線コード>.csv に保存する（取得記録 source.json 付き）。
// 使い方: node scripts/fetch-occto-tie.mjs 2026-10-02 [04,06,07,08,09,10]
// 手順は画面と同じ：検索（headerInput）→ CSV確認（ok：downloadKey と requestToken が返る）→ ダウンロード。2026-10-03「連系線の潮流を進めて」。
// 2026-11-02 セキュリティレビュー E：要求は地域と同じ session()（fetch-occto.mjs。HTTPS だけ・転送は失敗・200番台以外は失敗・要求の間1秒・応答の大きさの上限）。
//   session の再試行は切り（retry:false）、線ごとにログインからやり直す1回の再試行だけにする（1要求あたり最大2回のまま）。
//   CSV は保存の前に tie-csv.mjs で確かめ（見出し・288行・日付と時刻の並び・数字の形）、合わなければその線を失敗にする。
//   保存する文字列（Shift_JIS から変換した UTF-8）と、その文字列から計算する sha256 は以前と同じ。
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {session,parseBody} from './fetch-occto.mjs';
import {parseTieCsv} from './tie-csv.mjs';
const B='https://occtonet3.occto.or.jp/public/dfw/RP11/OCCTO/SD/';
const UA='powerflow-site research (local)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/** 1日分の連系線 CSV を取得して dir に保存する。fetchImpl・wait はテスト用 */
export async function fetchOcctoTie({date,codes=['04','06','07','08','09','10'],dir=`data/raw/occto-tie-${date}`,fetchImpl=fetch,wait=sleep,log=console.log}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date??''))throw Error('usage: <YYYY-MM-DD> [codes]');
 const newSession=()=>session({fetchImpl,wait,retry:false,userAgent:UA,log:()=>{}});
 let request=newSession();
 const json=async(url,body)=>parseBody(await request(url,body,true));
 const login=async()=>{await request(B+'LOGIN_login');await request(B+'CA01S070C?fwExtention.pathInfo=CA01S070C&fwExtention.prgbrh=0',{'fwExtention.pathInfo':'MENU'});};
 await login();
 const base={'fwExtention.pathInfo':'CA01S070C','fwExtention.prgbrh':'0','fwExtention.formId':'CA01S070P','transitionContextKey':'DEFAULT'};
 mkdirSync(dir,{recursive:true});
 const prev=existsSync(dir+'/source.json')?JSON.parse(readFileSync(dir+'/source.json','utf8')).files:[];
 const files=[];
 async function fetchCode(code){
  const day=date.replaceAll('-','/');
  const s=await json(B+'CA01S070C',{...base,'fwExtention.actionType':'reference','fwExtention.actionSubType':'headerInput',tgtRkl:code,spcDay:day});
  if(s.root.errMessage?.length)throw Error(code+' search: '+JSON.stringify(s.root.errMessage).slice(0,200));
  const h=s.root.bizRoot.header,form={...base,tgtRkl:code,spcDay:day,spcDayHdn:h.spcDayHdn.value,sntkTgtRklCdHdn:h.sntkTgtRklCdHdn.value,searchReqHdn:h.searchReqHdn.value};
  const ok=await json(B+'CA01S070C',{...form,'fwExtention.actionType':'reference','fwExtention.actionSubType':'ok'});
  if(ok.root.errMessage?.length)throw Error(code+' ok: '+JSON.stringify(ok.root.errMessage).slice(0,200));
  const k=ok.root.bizRoot.header;
  const buf=await request(B+'CA01S070C',{...form,'fwExtention.actionType':'reference','fwExtention.actionSubType':'download',downloadKey:k.downloadKey.value,requestToken:k.requestToken.value});
  const text=new TextDecoder('shift_jis').decode(buf);
  if(!text.startsWith('連系線,対象日付'))throw Error(code+' download failed: '+text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,120));
  parseTieCsv(text,date,code);
  writeFileSync(`${dir}/${code}.csv`,text);
  files.push({code,name:h.searchReqHdn.value,url:B+'CA01S070C',retrievedAt:new Date().toISOString().replace(/\.\d+Z/,'Z'),updated:h.updDaytime?.value,sha256:createHash('sha256').update(text).digest('hex'),rows:text.trim().split('\n').length-1});
  log(code,files.at(-1).name,files.at(-1).rows,'rows');
 }
 // 一時的な失敗（応答の途切れなど）はログインからやり直して1回だけ再試行する
 for(const code of codes){
  try{await fetchCode(code);}catch(e){log(code,'retry:',String(e.message).slice(0,100));request=newSession();await wait(5000);await login();await fetchCode(code);}
  await wait(1500);
 }
 writeFileSync(`${dir}/source.json`,JSON.stringify({purpose:'OCCTO 連系線潮流実績（CA01S070のCSV保存と同じもの）',userAgent:UA,files:[...prev.filter(p=>!files.some(f=>f.code===p.code)),...files]},null,2)+'\n');
 return files;
}

if(process.argv[1]?.endsWith('fetch-occto-tie.mjs')){
 const [date,codesArg]=process.argv.slice(2);
 await fetchOcctoTie({date,...(codesArg?{codes:codesArg.split(',')}:{})});
}
