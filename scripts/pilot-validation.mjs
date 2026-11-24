import approval from '../config/pilot-approval.json' with {type:'json'};
// Shared by the authenticated server and the client. Counts are not authorization.
export function validatePilot(data,sha256){
 if(sha256!==approval.sha256||data.datasetId!==approval.datasetId||data.revision!==approval.revision)throw Error('Unapproved pilot dataset/version');
 validatePilotStructure(data);
 return data;
}
export function validatePilotStructure(d){
 const require=(ok,message)=>{if(!ok)throw Error('Invalid pilot: '+message);};
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
 require(d?.schemaVersion===1&&d.rights==='pending','schema/rights');
 require([d.lines,d.facilities,d.banks,d.sourceMaps].every(v=>Array.isArray(v)&&v.length),'collections');
 require(text(d.scope)&&text(d.display?.coverageNote)&&text(d.display?.region)&&text(d.display?.rangeLabel)&&text(d.display?.summary),'coverage metadata');
 require(d.display.bounds==='geometry'&&Array.isArray(d.display.voltages)&&d.display.voltages.every(k=>Number.isFinite(k)&&k>0),'display voltages/bounds');
 require(Array.isArray(d.display.facilityKinds)&&d.display.facilityKinds.every(k=>k==='substation')&&typeof d.display.capabilities?.capacityOverlay==='boolean'&&d.display.capabilities.flow===false,'capabilities');
 const all=[...d.lines,...d.facilities,...d.banks,d.junction];
 require(all.every(v=>text(v?.id))&&new Set(all.map(v=>v.id)).size===all.length,'duplicate/missing IDs');
 const facilities=new Set(d.facilities.map(f=>f.id)),nodes=new Set([...facilities,d.junction.id]);
 const source=s=>require(text(s?.title)&&text(s?.target)&&text(s?.published)&&text(s?.retrievedAt)&&/^https:\/\//.test(s?.url)&&/^[a-f0-9]{64}$/.test(s?.sha256),'source metadata');
 const capacity=c=>{
  require(text(c?.officialId)&&Number.isFinite(c.primaryKV),'capacity identity');
  for(const v of [c.equipmentMW,c.operatingMW])require(v===null||Number.isFinite(v),'capacity number');
  for(const v of [c.available,c.upstream])require(typeof v?.raw==='string'&&(v.mw===null||Number.isFinite(v.mw)),'capacity missing/zero');
  source(c.source);
 };
 for(const f of d.facilities){require(point(f.position)&&Array.isArray(f.voltageKV)&&f.voltageKV.every(Number.isFinite),'facility');if(f.upperReference)source(f.upperReference.source);}
 for(const l of d.lines){
  require(nodes.has(l.from)&&facilities.has(l.to),'line endpoint reference');
  require(['ac','dc','unknown'].includes(l.currentType)&&d.display.voltages.includes(l.voltageKV),'electrical attributes');
  require(Array.isArray(l.geometry?.points)&&l.geometry.points.length>1&&l.geometry.points.every(point)&&l.geometry.points.length===l.geometry.nodeIds?.length&&l.geometry.wayIds?.length>0,'geometry');
  capacity(l.capacity);require(l.capacity.primaryKV===l.voltageKV,'line capacity voltage');
 }
 for(const b of d.banks){require(facilities.has(b.facilityId)&&Number.isFinite(b.secondaryKV),'bank reference');capacity(b);}
 require(facilities.has(d.upper?.facilityId)&&point(d.junction.position),'upper/junction reference');
 d.sourceMaps.forEach(source);
}
