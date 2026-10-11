import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// /product-ready reads process.env while rendering. If Next.js prerenders it at
// build time (Docker build has no runtime secrets) the public page shows a frozen
// "BLOCKED" that no longer reflects the running server. It must render per request.
describe('/product-ready reflects the running server, not the build environment', () => {
  it('opts out of static prerendering', () => {
    const source = readFileSync(join(process.cwd(), 'app', 'product-ready', 'page.tsx'), 'utf8');
    expect(source).toMatch(/export const dynamic\s*=\s*['"]force-dynamic['"]/);
  });
});
