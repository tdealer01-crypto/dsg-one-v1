# DSG ONE delegated Auth0 token renewal — 2026-10-10

## Scope / truth boundary

This change applies to the **DSG ONE website Auth0 SPA client** at
`/dsg/autonomous-level`, which is **not** the ChatGPT-hosted custom DSG
Spacetime MCP plugin and is not the Desktop Commander/RDC OAuth client.
It cannot alter expiry or renewal behavior for unrelated plugins (GitHub,
Google, etc.). The ChatGPT client—not the DSG MCP resource server—controls
storage and renewal of its own OAuth access/refresh credentials.

## Website change

- Ask Auth0 for `openid profile email dsg.use offline_access` and use
  `useRefreshTokens: true`, `useRefreshTokensFallback: false`, and
  `cacheLocation: 'memory'` with Auth0 SPA JS v2.28.2.
- SDK attempts rotating refresh on subsequent `getTokenSilently()` calls
  while the current browser instance retains its in-memory refresh token.
- Closing/reloading the page clears the in-memory credential by design.
  A persisted DSG actor↔Auth0 subject link **never** counts as a valid
  delegated access token. The user must explicitly resume login when needed.
- A revoked, missing, or invalid refresh token becomes a visible
  `AUTH0_REAUTH_REQUIRED` state and never starts an automatic redirect loop.
- No refresh/access token is written to localStorage, sessionStorage,
  server logs, cookies or ChatGPT chat. Backend verifies exact Auth0 JWT,
  `azp`, issuer, audience, scope and per-workspace mapping on each tool call.
- Do not weaken token expiry, reuse Owner credentials, or call governed
  mutation tools to diagnose the login.

## Auth0 administrator prerequisite (not performed by this PR)

For the *existing DSG ONE SPA Auth0 application only*, inspect the
application whose Client ID is already bound in source (do not create a
replacement, do not send credentials in chat):

1. Application Type: Single Page Application; Authorization Code + PKCE S256.
2. Enable **Refresh Token Rotation** with appropriately bounded absolute
   and idle expiration, and verify Refresh Token grant is enabled for this
   exact application/resource configuration.
3. Confirm `offline_access` is granted as requested and the API is
   permitted for `dsg.use`. Do not put `offline_access` in the
   Spacetime resource scope enforcement setting: that belongs to the
   authorization server/token issuance, not the MCP route authorization.
4. Verify exact HTTPS Allowed Callback URL
   `https://dsg.pics/dsg/autonomous-level`, Allowed Web Origins
   `https://dsg.pics`, Allowed Logout URL and CORS origins.
5. Do not modify the independent Auth0 client used by the **ChatGPT DSG
   Spacetime MCP plugin** without inspecting its actual Client ID, grant
   types, registered redirect URL and token-exchange failure. A React SPA
   refresh change does not repair ChatGPT's connector reauthorization loop.

## Acceptance (must witness, not infer from CI)

- Authorize once, capture refresh-token issuance as a masked Boolean (no
  token text), make a delegated read using the verified user's JWT.
- Allow the access token to expire; execute a subsequent read using the
  SDK's refresh path without interactive login.
- Revoke the refresh grant; verify the page returns
  `AUTH0_REAUTH_REQUIRED` and does not redirect automatically.
- Reload page and verify a prior linked subject does **not** imply an
  authenticated delegated session; user action required.
- Verify exact JWT audience/issuer/azp/scope, principal-bound evidence and
  chain integrity. Run a separate ChatGPT web/mobile host connector test;
  report host errors separately from AWS server OAuth.
- Source PR + CI != production deployment or E2E proof.

Status: SOURCE_STAGED; provider settings, production build and live E2E
must be verified independently.
