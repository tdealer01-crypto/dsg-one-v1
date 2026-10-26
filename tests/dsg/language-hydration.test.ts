import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DsgCopy, translateDsgCopy } from '../../components/app-language-copy-bridge';

afterEach(() => vi.unstubAllGlobals());

describe('owned UI copy and hydration', () => {
  it('keeps the server snapshot stable even with an English client preference', () => {
    vi.stubGlobal('React', React);
    vi.stubGlobal('window', { localStorage: { getItem: () => 'en' } });
    expect(renderToStaticMarkup(React.createElement(DsgCopy, { value: 'Goal' }))).toBe('เป้าหมาย');
  });

  it('preserves both existing language mappings without rewriting identifiers or user content', () => {
    expect(translateDsgCopy('Goal', 'th')).toBe('เป้าหมาย');
    expect(translateDsgCopy('เป้าหมาย', 'en')).toBe('Goal');
    for (const value of ['goal-123', 'APPROVAL_REQUIRED', 'My Goal is to write code', 'https://dsg.pics/Goal', 'const Goal = 42']) {
      expect(translateDsgCopy(value, 'th')).toBe(value);
    }
  });
});
