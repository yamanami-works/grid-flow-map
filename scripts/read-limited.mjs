// 応答の本体を上限まで読む共通の処理（2026-11-24。もとは fetch-occto.mjs の readLimited）。
// 読みながら数え、上限を超えたらその場で読むのをやめて失敗する（極端に大きな応答で実行環境のメモリを使い切らない）。
// fetch は gzip などを展開してから渡すので、数えるのは展開後のバイト数。Content-Length による事前の拒否も残す（それだけには頼らない）。
export async function readLimited(r, maxBytes) {
  const tooLarge = () => Object.assign(Error(`response too large (over ${maxBytes} bytes)`), {code: 'TOO_LARGE'}); // 呼び出し側は code で見分ける
  if (Number(r.headers?.get?.('content-length')) > maxBytes) { await r.body?.cancel?.().catch(() => {}); throw tooLarge(); }
  if (!r.body?.getReader) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > maxBytes) throw tooLarge(); return b; }
  const reader = r.body.getReader(), chunks = []; let n = 0;
  for (;;) { const {done, value} = await reader.read(); if (done) break; n += value.length; if (n > maxBytes) { await reader.cancel().catch(() => {}); throw tooLarge(); } chunks.push(value); }
  return Buffer.concat(chunks);
}
