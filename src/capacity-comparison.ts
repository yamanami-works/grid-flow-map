import {endpointName} from './endpoint-aliases.ts';
type Capacity={capacityMW:number|null;constraint?:string};
export function compareCapacity(network:Capacity&{direction:string},occto:Capacity&{from:string;to:string;name?:string;voltageKV?:number}){
 const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
 const endpoint=(s:string)=>occto.name&&occto.voltageKV!==undefined?endpointName({name:occto.name,voltageKV:occto.voltageKV},s):norm(s);
 const messages:string[]=[];
 if(network.direction.split('→').map(endpoint).join('→')!==[occto.from,occto.to].map(endpoint).join('→'))messages.push('適用方向・区間が異なります。容量の大小は直接比較できません。');
 if(network.capacityMW!==null&&occto.capacityMW!==null&&network.capacityMW!==occto.capacityMW)messages.push(`運用容量の公表値に差があります：東北電力NW ${network.capacityMW.toLocaleString('ja-JP')} MW / OCCTO ${occto.capacityMW.toLocaleString('ja-JP')} MW。`);
 if(network.constraint&&occto.constraint&&norm(network.constraint)!==norm(occto.constraint))messages.push('容量の制約要因が異なります。');
 if(network.capacityMW===null||occto.capacityMW===null)messages.push('容量が未公表のため数値比較できません。');
 return messages;
}
