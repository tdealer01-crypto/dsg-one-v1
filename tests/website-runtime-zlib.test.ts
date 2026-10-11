import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dockerfile = readFileSync('Dockerfile', 'utf8');

describe('Production container zlib vulnerability gate', () => {
  it('requires a patched Alpine zlib build instead of the vulnerable base-image package', () => {
    expect(dockerfile).toContain("'zlib>=1.3.2-r1'");
    expect(dockerfile).toContain('CVE-2026-85091');
    expect(dockerfile).not.toContain('apk add --no-cache ca-certificates python3 py3-pip');
  });
});
