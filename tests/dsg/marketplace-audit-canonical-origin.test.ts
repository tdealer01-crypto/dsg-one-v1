import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../app/api/dsg/marketplace/audit-packet/route';

function configure(mode = 'production', canonical = 'https://dsg.pics', legacy = 'http://127.0.0.1:8080') {
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('DSG_CANONICAL_APP_URL', canonical);
  vi.stubEnv('APP_URL', legacy);
}

async function request(query = '', headers?: HeadersInit) {
  return GET(new Request(`http://127.0.0.1:8080/api/dsg/marketplace/audit-packet${query}`, { headers }));
}

describe('audit packet canonical public origin', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses explicit public canonical origin despite internal request and APP_URL', async () => {
    configure();
    const response = await request('?baseUrl=https%3A%2F%2Fdsg.pics');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, baseUrl: 'https://dsg.pics' });
  });

  it('keeps arbitrary baseUrl overrides blocked', async () => {
    configure();
    const response = await request('?baseUrl=https%3A%2F%2Fother.example');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false, error: { code: 'BASE_URL_MISMATCH' }, canonicalBase: 'https://dsg.pics',
    });
  });

  it('refuses request-origin fallback in production even with forwarded headers', async () => {
    configure('production', '', '');
    const response = await request('', { 'x-forwarded-host': 'dsg.pics', 'x-forwarded-proto': 'https' });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'INVALID_APP_URL_CONFIG' } });
  });

  it('preserves unconfigured development request origin without trusting forwarded headers', async () => {
    configure('development', '', '');
    const response = await request('', { 'x-forwarded-host': 'attacker.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseUrl: 'http://127.0.0.1:8080' });
  });

  it('preserves an explicit legacy HTTPS origin when canonical setting is absent', async () => {
    configure('production', '', 'https://custom.example/');
    const response = await request('?baseUrl=https%3A%2F%2Fcustom.example');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseUrl: 'https://custom.example' });
  });

  it('does not mistake an operator-configured DNS name for a loopback address', async () => {
    configure('production', 'https://127.example.com', '');
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseUrl: 'https://127.example.com' });
  });

  it('preserves explicit local HTTP configuration in development', async () => {
    configure('development', '', 'http://localhost:3100/');
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseUrl: 'http://localhost:3100' });
  });

  it('preserves legacy development APP_URL base-path normalization', async () => {
    configure('development', '', 'http://localhost:3100/app?preview=1#section');
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseUrl: 'http://localhost:3100' });
  });

  it.each([
    'http://dsg.pics',
    'https://localhost',
    'https://sub.localhost.',
    'https://127.0.0.2',
    'https://2130706433',
    'https://0.0.0.0',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
    'https://user:private-config-value@dsg.pics',
    'https://dsg.pics/path',
    'https://dsg.pics?secret=private-config-value',
    'https://dsg.pics#private-config-value',
    'not-an-origin-private-config-value',
  ])('fails closed for invalid production canonical configuration: %s', async (canonical) => {
    configure('production', canonical, 'https://legacy.example');
    const response = await request();
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('INVALID_APP_URL_CONFIG');
    expect(body).not.toContain('private-config-value');
    expect(body).not.toContain(canonical);
  });

  it('does not reflect a malformed credential-bearing baseUrl input', async () => {
    configure();
    const response = await request('?baseUrl=' + encodeURIComponent('https://user:private-config-value@'));
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain('private-config-value');
  });

  it('carries the trusted public configuration into the final runtime image', () => {
    const dockerfile = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');
    const runner = dockerfile.split('AS runner')[1];
    expect(runner).toMatch(/^ENV DSG_CANONICAL_APP_URL=https:\/\/dsg\.pics$/m);
  });
});
