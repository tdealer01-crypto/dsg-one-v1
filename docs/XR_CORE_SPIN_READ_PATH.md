# XR → Core Spin → Spacetime read path

Status: implementation contract; live Meta/Auth0 federation is still open.

The new authenticated DSG endpoint is:

`POST /api/dsg/xr/intent`

It accepts the existing XR intent envelope but currently allows only the production-safe world read vertical slice:

`world.read / READ_REGION / route.xr-world.read / target=*`

The endpoint resolves the authenticated DSG actor through the existing Supabase workspace boundary. The client-supplied `owner_id` is never trusted: it is replaced with the verified actor ID before the proposal reaches Core Spin.

Execution path:

`XR envelope → verified DSG actor → normalize strict payload → Core Spin → DSG Spacetime → evidence`

No direct provider access exists in this endpoint.

Not yet claimed:
- Meta Auth0 token federation into DSG ONE authentication
- physical Quest proof
- world.write
- payment or settlement
- live production deployment of this endpoint
