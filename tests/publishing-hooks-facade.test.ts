import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import * as publishingHooks from '../src/publishing-hooks/index.js';

// tummycrypt_tinyland_publishing_hooks was merged into this module. The
// ./publishing-hooks subpath keeps its exact runtime API. The root facade does
// not re-export it, so the existing root names (ContentType and friends) are
// untouched.
describe('publishing hooks merge', () => {
  afterEach(() => {
    publishingHooks.resetPublishingHooksConfig();
  });

  it('keeps the original runtime API on the ./publishing-hooks subpath', () => {
    expect(Object.keys(publishingHooks).sort()).toEqual([
      'configurePublishingHooks',
      'getPublishingHooksConfig',
      'onContentCreate',
      'onContentDelete',
      'onContentPublish',
      'onContentSchedule',
      'onContentUpdate',
      'onPublishingChange',
      'recordAutoVersion',
      'recordContentVersion',
      'recordCreateVersion',
      'recordEditVersion',
      'recordStatusChangeVersion',
      'resetPublishingHooksConfig',
    ]);
  });

  it('declares the ./publishing-hooks export in package.json', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    expect(manifest.exports['./publishing-hooks']).toEqual({
      types: './dist/publishing-hooks/index.d.ts',
      import: './dist/publishing-hooks/index.js',
    });
  });

  it('keeps the original configuration defaults and reset', () => {
    expect(publishingHooks.getPublishingHooksConfig().baseUrl).toBe('http://localhost:5174');
    publishingHooks.configurePublishingHooks({ baseUrl: 'https://example.test' });
    expect(publishingHooks.getPublishingHooksConfig().baseUrl).toBe('https://example.test');
    publishingHooks.resetPublishingHooksConfig();
    expect(publishingHooks.getPublishingHooksConfig().baseUrl).toBe('http://localhost:5174');
  });
});
