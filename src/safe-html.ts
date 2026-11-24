export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function externalLink(url:string,label:string){
 try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Unsafe URL');
 return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer" title="新しいタブで開く：${escapeHtml(parsed.hostname)}">${escapeHtml(label)} ↗</a>`;
 }catch{return `<span>${escapeHtml(label)}（リンクを確認中）</span>`;}
}
