// No purchase verifier or paid dataset is deployed yet. Deny protected routes by default.
export function isProtectedPath(path){return /^\/(?:api\/(?:paid|admin)|protected)(?:\/|$)/.test(path);}
export function authorizeProtectedRequest(){return false;}
