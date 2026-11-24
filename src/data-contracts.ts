import type {Feature} from './access-policy';
export type AssetKind='line'|'circuit'|'substation'|'bank'|'plant'|'unit'|'switchyard'|'converter';
export type EvidenceStatus='verified'|'candidate'|'unmatched';
export type MissingReason='not-published'|'not-acquired'|'unmatched'|'missing-observation'|'not-applicable';
export interface SourceBinding {
 source:string;externalId:string;role:'geometry'|'measurement'|'equipment';
 status:EvidenceStatus;evidence:string;validFrom:string|null;validTo:string|null;
}
export interface Asset {
 id:string;kind:AssetKind;name:string;aliases:string[];parentId:string|null;
 region:string;voltageKV:number[];status:EvidenceStatus;bindings:SourceBinding[];
}
export interface CapacityObservation {
 assetId:string;kind:'equipment'|'operating'|'available-local'|'available-upstream'|'generation';
 value:number|null;unit:'MW'|'MVA';missingReason:MissingReason|null;
 sourceId:string;publishedAt:string;retrievedAt:string;validFrom:string|null;validTo:string|null;
 direction:{fromAssetId:string;toAssetId:string}|null;
 scope:'asset'|'circuit'|'bank'|'unit'|'group';conditions:string[];
}
export interface DatasetDescriptor {
 id:string;region:string;purpose:string;feature:Feature;access:'public'|'protected';
 url:string;schemaVersion:number;sourceIds:string[];
  // 潮流以外の中身のハッシュ（scripts/prepare-foundation.mjs）。URL に ?v= で付けてキャッシュを使う
  version?:string;
}
export interface DatasetManifest {schemaVersion:1;datasets:DatasetDescriptor[]}
