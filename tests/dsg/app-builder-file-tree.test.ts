import { describe, expect, it } from 'vitest';
import { buildDeterministicFileTree } from '@/lib/dsg/app-builder/file-tree';

describe('file tree', () => {
  it('hash deterministic', () => {
    const a = buildDeterministicFileTree([{ path: 'a.txt', content: 'x' }]);
    const b = buildDeterministicFileTree([{ path: 'a.txt', content: 'x' }]);
    expect(a.treeHash).toBe(b.treeHash);
  });
  it('blocks traversal and env', () => {
    expect(() => buildDeterministicFileTree([{ path: '../x', content: '' }])).toThrow();
    expect(() => buildDeterministicFileTree([{ path: '.env', content: '' }])).toThrow();
    expect(() => buildDeterministicFileTree([{ path: '.env.example', content: '' }])).not.toThrow();
  });
});
