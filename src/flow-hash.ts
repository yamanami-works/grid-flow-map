// 日別の潮流データの照合（2026-11-24）：受け取ったバイト列の SHA-256 の先頭12桁が、一覧（-latest.json の index）の hash と合うときだけ採る。
// hash は scripts/flow-split.mjs の hashOf（書き出した JSON 文字列の sha256 の先頭12桁）。配信は加工しない（dist はそのまま、手元のサーバーも日別ファイルは縮めない）。
// crypto.subtle は安全な接続（https・localhost）でだけ使える。照合できないときは採らない。
export async function verifiedDay(bytes: ArrayBuffer, hash: string, subtle: SubtleCrypto | null | undefined = globalThis.crypto?.subtle): Promise<unknown> {
  if (!subtle) throw Error('day file: SHA-256 is unavailable (insecure context)');
  const digest = Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest.slice(0, 12) !== hash) throw Error('day file: hash mismatch');
  return JSON.parse(new TextDecoder().decode(bytes));
}
