import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { POST } from '@/app/api/dsg/identity/link/route';

describe('Auth0 principal safety checks', () => {
  it('rejects absent and invalid credentials', async () => {
    expect(await verifyDsgAuth0Principal(undefined)).toBeNull();
    expect(await verifyDsgAuth0Principal('not-a-jwt')).toBeNull();
  });

  it('rejects link requests from a foreign web origin', async () => {
    const request = new NextRequest('https://dsg.pics/api/dsg/identity/link', {
      method: 'POST',
      headers: { origin: 'https://example.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'ORIGIN_DENIED' });
  });
});
