import {endpointName} from './endpoint-aliases.ts';
// OCCTOが幹線と支線をまとめて1行で公表する区間（東北NWの容量表では2行）。地図上は両方の線を共有ノードでたどる。
// 勿来幹線：東北NWは「勿来幹線 須賀川→発電所」「勿来支線 勿来幹線分岐→いわき」、OCCTOは「勿来幹線 須賀川→いわき」（2026-10-02確認）
const COMBINED_ROWS:Record<string,string[]>={'勿来幹線|275':['須賀川変電所','いわき変電所']};
export function endpointConflict(record:{name:string;voltageKV:number;from:string;to:string}, lines:{name:string;voltageKV:number;direction:string}[]) {
 const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
 const combined=COMBINED_ROWS[norm(record.name)+'|'+record.voltageKV];if(combined&&[record.from,record.to].sort().join('|')===[...combined].sort().join('|'))return false;
 const matches=lines.filter(l=>norm(l.name)===norm(record.name)&&l.voltageKV===record.voltageKV);
 const endpoint=(s:string)=>endpointName(record,s);
 return matches.length===1 && matches[0].direction.split('→').map(endpoint).sort().join('|')!==[record.from,record.to].map(endpoint).sort().join('|');
}
