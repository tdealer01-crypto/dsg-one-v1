export function evaluateAuthRbacProof(input:{publicOk:boolean; anonBlocked:boolean; nonAdminBlocked:boolean; oauthTestable?:boolean}){
 if(input.oauthTestable===false) return {status:'MANUAL_REQUIRED'};
 return {status: input.publicOk && input.anonBlocked && input.nonAdminBlocked ? 'PASS' : 'BLOCK'};
}
