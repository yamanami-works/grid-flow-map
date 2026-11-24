export type Feature = 'trunk-map' | 'flow' | 'capacity-detail' | 'distribution-map' | 'capacity-overlay';
export type DisplayMode = 'voltage' | 'flow';
export const featurePolicy:Record<Feature,'free'|'paid'|'retired'>={
 'trunk-map':'free',flow:'free','capacity-detail':'free','distribution-map':'paid','capacity-overlay':'retired',
};
export interface Entitlement {features:Feature[];expiresAt:string}
// Entitlements must come from a trusted verifier. A client decision is never server authorization.
export function canUse(feature:Feature,entitlement:Entitlement|null,now=Date.now()){
 if(featurePolicy[feature]==='retired')return false;
 return featurePolicy[feature]==='free'||!!(entitlement&&Date.parse(entitlement.expiresAt)>now&&entitlement.features.includes(feature));
}
export const displayFeature:Record<DisplayMode,Feature>={voltage:'trunk-map',flow:'flow'};
export {electricalColor as voltageColor} from './display-settings.ts';
