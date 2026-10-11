import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = process.cwd();
const asset=(name:string)=>readFileSync(join(root,'public','dsg-os',name),'utf8');

describe('DSG OS static authoring and verification truth boundary',()=>{
 it('does not give browser UI execution or customer approval authority',()=>{
   const page=readFileSync(join(root,'app','dsg-os','page.tsx'),'utf8');
   const builder=asset('adapter-builder/index.html');
   expect(page).toContain('Compilation is not registration or authorization');
   expect(page).toContain('do not register routes, resolve approvals');
   expect(builder).toContain('This page does not execute providers or grant permissions');
   expect(builder).toContain("result_verifier:'provider_readback'");
   expect(builder).not.toContain("result_verifier:'browser_state_readback'");
 });
 it('copies the real verifier substrate under relative import paths',()=>{
   expect(asset('adapter-builder/adapter-builder.js')).toContain("../execution-verifier/laplacian-verify.js");
   expect(asset('execution-verifier/provider-adapter-v2-verify.js')).toContain("verifyProviderEnvelope");
   expect(asset('execution-verifier/attestation-verify.js')).toContain("verifyAttestation");
   const verifier=asset('verify/index.html');
   expect(verifier).toContain("verifyProviderEnvelope(content,pin)");
   expect(verifier).toContain("verifyAttestation(content.attestation,content.record,pin)");
   expect(verifier).toContain("SIGNATURE VALID BUT UNPINNED");
   expect(verifier).not.toContain("fetch(");
 });
});
