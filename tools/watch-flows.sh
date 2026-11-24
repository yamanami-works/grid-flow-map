#!/usr/bin/env bash
# テスト用マップ（app複製）のOCCTO潮流を更新し続ける。書き込み先は app/ 内だけ。
# 使い方: bash tools/watch-flows.sh（app で実行）   （止めるときはこのプロセスを終了）
# 中身は scripts/update-all.mjs（全エリア＋連系線を1回更新）の繰り返し。常設配信ではスケジューラから update-all.mjs を直接呼ぶ（2026-10-03）
# 2026-10-04：「実行して30分休む」だと公表前に取りに行った地域が次の回まで30分遅れる（21:59開始の回で東北などが21:30止まり）。
# OCCTOの30分値の公表直後（毎時02分・32分）に始め、終わった時点で最新の時刻がそろっていない公表元があれば5分後に取り直す（最大3回）。
cd "$(dirname "$0")/.." || exit 1
lagging() { node -e "
const fs=require('fs');const files=['occto-tohoku','hokkaido-flow','tokyo-flow','chubu-flow','hokuriku-flow','kansai-flow','chugoku-flow','shikoku-flow','kyushu-flow','tie-flow'];
const now=new Date(Date.now()+9*3600e3),slot=new Date(Math.floor((now-2*60e3)/1800e3)*1800e3).toISOString().slice(0,19);
const late=files.filter(f=>{try{const d=JSON.parse(fs.readFileSync('public/data/'+f+'.json','utf8')).days[0];let li=-1;for(let i=47;i>=0;i--)if(d.actual.lines.some(l=>l.values[i]!=null)){li=i;break}return (d.actual.times[li]??'')<slot;}catch{return true}});
if(late.length){console.log(late.join(' '));process.exit(0)}process.exit(1)"; }
while true; do
  echo "[$(date '+%F %T')] update-all"
  node scripts/update-all.mjs 2>&1 | tail -1
  for t in 1 2 3; do
    late=$(lagging) || break
    echo "[$(date '+%F %T')] 最新時刻がまだの公表元: $late → 5分後に再取得（$t回目）"
    sleep 300; node scripts/update-all.mjs 2>&1 | tail -1
  done
  # 次の 02分・32分 まで待つ
  now=$(date +%s); next=$(( (now/1800+1)*1800 + 120 )); sleep $(( next - now ))
done
