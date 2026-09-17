/**
 * Renders the whole app to a string. Catches module-level failures (produce bundle, schema,
 * imports that only work in Node) that a white page in the browser would otherwise hide.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

describe('web app', () => {
  it('renders the shell before any climate data arrives', async () => {
    Object.assign(globalThis, {
      location: new URL('http://localhost/'),
      history: { replaceState() {} },
    });
    const { App } = await import('../src/web/App');
    const html = renderToString(createElement(App));
    expect(html).toContain('in season in');
  });

  it('bundles every produce record', async () => {
    const { PRODUCE } = await import('../src/web/produce');
    expect(PRODUCE.length).toBeGreaterThanOrEqual(90);
  });
});
