import { NextResponse } from 'next/server';
import { createDsgAuditPacket } from '@/lib/dsg/marketplace/audit-packet';
import { validateApiKeyFromHeaders, recordApiKeyUsage } from '@/lib/dsg/mcp/validate-api-key';

export const dynamic = 'force-dynamic';

function resolveCanonicalBase(reqUrl: URL): string {
  // The public origin is distinct from an internal APP_URL behind the AWS proxy.
  // Its image-level configuration must not come from untrusted request headers.
  const canonicalSetting = process.env.DSG_CANONICAL_APP_URL;
  const configured = canonicalSetting || process.env.APP_URL;
  const production = process.env.NODE_ENV === 'production';
  if (!configured) {
    if (production) throw new Error('CANONICAL_APP_ORIGIN_REQUIRED');
    return reqUrl.origin;
  }

  const canonical = new URL(configured);
  if (!['https:', 'http:'].includes(canonical.protocol)
      || canonical.username || canonical.password
      || ((production || canonicalSetting)
        && (canonical.pathname !== '/' || canonical.search || canonical.hash))) {
    throw new Error('CANONICAL_APP_ORIGIN_INVALID');
  }

  const hostname = canonical.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  const local = hostname === 'localhost' || hostname.endsWith('.localhost')
    || /^127(?:\.\d{1,3}){3}$/.test(hostname) || hostname === '0.0.0.0'
    || hostname === '::' || hostname === '::1' || /^::(?:ffff:)?7f[0-9a-f]{2}:/.test(hostname);
  if (production && (canonical.protocol !== 'https:' || local)) {
    throw new Error('CANONICAL_APP_ORIGIN_NOT_PUBLIC_HTTPS');
  }
  return canonical.origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // MCP API key path — validate and meter before running the full audit
  if (req.headers.get('x-dsg-api-key') !== null) {
    const validation = await validateApiKeyFromHeaders(new Headers(req.headers));
    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'INVALID_API_KEY' },
          nextAction: 'Obtain a valid DSG_API_KEY from /dsg/api-keys',
        },
        { status: 401 },
      );
    }
    const toolName = url.searchParams.get('tool') ?? 'audit-packet';
    recordApiKeyUsage(validation.keyId, validation.actorId, toolName).catch(() => {});
  }

  let canonicalBase: string;

  try {
    canonicalBase = resolveCanonicalBase(url);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INVALID_APP_URL_CONFIG', message: 'Canonical app origin configuration is invalid.' },
        nextAction: 'Set DSG_CANONICAL_APP_URL to the trusted public HTTPS origin; APP_URL is a legacy fallback. Request-origin fallback is development-only.',
      },
      { status: 500 },
    );
  }

  const requestedBaseUrl = url.searchParams.get('baseUrl');

  if (requestedBaseUrl) {
    let requestedOrigin: string;
    try {
      requestedOrigin = new URL(requestedBaseUrl).origin;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'INVALID_BASE_URL', message: 'baseUrl must be a valid absolute URL.' },
          nextAction: 'Remove the baseUrl query parameter or set it to the configured canonical origin.',
        },
        { status: 400 },
      );
    }

    if (requestedOrigin !== canonicalBase) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'BASE_URL_MISMATCH', message: 'baseUrl query parameter does not match the canonical base URL.' },
          canonicalBase,
          requestedBaseUrl: requestedOrigin,
          nextAction: 'Use the configured canonical origin for audit packets; arbitrary baseUrl overrides are blocked.',
        },
        { status: 400 },
      );
    }
  }

  return NextResponse.json(createDsgAuditPacket(canonicalBase));
}
