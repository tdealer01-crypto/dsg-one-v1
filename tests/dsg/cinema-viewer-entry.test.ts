import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DsgCinemaOauthViewer } from '@/components/dsg-cinema-oauth-viewer';

// The repository's Vitest JSX transform uses the classic React runtime.
beforeAll(() => { vi.stubGlobal('React', React); });
afterAll(() => { vi.unstubAllGlobals(); });

function render(ready: boolean, unavailable = false) {
  const onSignIn = vi.fn(async () => {});
  const readGovernedStatus = vi.fn(async () => null);
  const html = renderToStaticMarkup(createElement(DsgCinemaOauthViewer, {
    ready, unavailable, onSignIn, readGovernedStatus, onWorkingChange: vi.fn(),
  }));
  const entry = html.match(/<button\b([^>]*)>([^<]*Shared Browser[^<]*)<\/button>/);
  expect(entry).not.toBeNull();
  return { attributes: entry![1], label: entry![2], html, onSignIn, readGovernedStatus };
}

describe('Viewer entry before tool authentication', () => {
  it('offers an enabled sign-in action instead of a disabled viewer when the tool session is absent', () => {
    const result = render(false);
    expect(result.label).toBe('เข้าสู่ระบบเพื่อเปิด Shared Browser');
    expect(result.attributes).not.toMatch(/\sdisabled(?:\s|=|$)/);
    expect(result.readGovernedStatus).not.toHaveBeenCalled();
    expect(result.onSignIn).not.toHaveBeenCalled();
  });

  it('keeps the existing primary viewer action once the session is ready', () => {
    const result = render(true);
    expect(result.label).toBe('เปิด Shared Browser ของฉัน');
    expect(result.attributes).not.toMatch(/\sdisabled(?:\s|=|$)/);
  });

  it.each([false, true])('does not start another flow during initialization, another command or pending approval (ready=%s)', ready => {
    const result = render(ready, true);
    expect(result.attributes).toMatch(/\sdisabled(?:\s|=|$)/);
    expect(result.onSignIn).not.toHaveBeenCalled();
    expect(result.readGovernedStatus).not.toHaveBeenCalled();
  });
});
