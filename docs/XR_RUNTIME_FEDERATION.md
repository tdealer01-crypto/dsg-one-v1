# Runtime OAuth → DSG ONE trusted XR federation

Status: implementation contract; deployment/readback remains separate proof.

Trust path:

`Meta client → DSG Spacetime XR edge → Auth0 verification → internal authenticated DSG ONE ingress → Core Spin → DSG Spacetime MCP → XR world provider → evidence`

The internal ingress is:

`POST /api/dsg/xr/internal-intent`

Rules:

- the endpoint is not a public OAuth endpoint;
- caller authentication uses the existing `DSG_SPACETIME_INTERNAL_API_KEY`;
- Runtime supplies a principal only after Auth0 verification;
- accepted federated principals must be `oauth:<verified-sub>`;
- client-provided `owner_id` is replaced with the verified principal;
- current vertical slice remains read-only: `world.read / READ_REGION / route.xr-world.read`;
- Core Spin remains orchestration authority; DSG Spacetime remains execution/evidence authority;
- failure of the configured Core Spin bridge must fail closed rather than fall back to direct provider execution.

No new secret is introduced by this bridge.
