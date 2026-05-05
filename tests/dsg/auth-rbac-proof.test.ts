import { describe,it,expect } from 'vitest'; import { evaluateAuthRbacProof } from '@/lib/dsg/runtime/auth-rbac-proof';
describe('auth proof',()=>{it('manual when oauth untestable',()=>expect(evaluateAuthRbacProof({publicOk:true,anonBlocked:true,nonAdminBlocked:true,oauthTestable:false}).status).toBe('MANUAL_REQUIRED'));});
