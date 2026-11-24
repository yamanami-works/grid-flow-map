import {electricalColor} from './display-settings.ts';
export type PilotValue={raw:string;mw:number|null};
export type PilotSource={title:string;target:string;url:string;published:string;retrievedAt:string;sha256:string};
export type PilotCapacity={officialId:string;name:string;primaryKV:number;secondaryKV?:number;bankCount?:number;circuitCount?:number;equipmentMW:number|null;operatingMW:number|null;available:PilotValue;upstream:PilotValue;source:PilotSource;matchStatus:string};
export type PilotFacility={id:string;name:string;osmWay:number;position:[number,number];voltageKV:number[];upperReference?:{lineName:string;officialId:string;voltageKV:number;publicSection:string;source:PilotSource;status:string}};
export type PilotLine={currentType:'ac'|'dc'|'unknown';id:string;name:string;voltageKV:number;from:string;to:string;publicSection:string;geometry:{points:[number,number][];nodeIds:number[];wayIds:number[];status:string};capacity:PilotCapacity};
export type PilotBank=PilotCapacity&{id:string;facilityId:string;scope:string};
export type MiyagiPilot={datasetId:string;revision:string;display:{rangeLabel:string;region:string;coverageNote:string;summary:string;voltages:number[];facilityKinds:string[];capabilities:{capacityOverlay:boolean;flow:boolean};bounds:'geometry';connectionLegend:string};schemaVersion:1;scope:string;rights:'pending';reviewedAt:string;facilities:PilotFacility[];lines:PilotLine[];banks:PilotBank[];junction:{id:string;name:string;osmNode:number;position:[number,number];status:string};upper:{facilityId:string;line:string;voltageKV:number;publicSection:string;officialId:string};sourceMaps:PilotSource[];note:string};
export const pilotVoltageColor=(kv:number)=>electricalColor({voltageKV:kv,currentType:'ac'},'lower');

export const pilotCounts=(d:MiyagiPilot)=>({lines:d.lines.length,geographicSegments:d.lines.reduce((n,l)=>n+l.geometry.wayIds.length,0),facilities:d.facilities.length,banks:d.banks.length});
export const capacityEditions=(d:MiyagiPilot)=>[...new Set([...d.lines.map(l=>l.capacity),...d.banks].map(c=>c.source.published))];
