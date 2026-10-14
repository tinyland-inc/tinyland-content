import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as scheduledPublishing from '../src/scheduled-publishing/index.js';
import type { ScheduledItem } from '../src/scheduled-publishing/index.js';

// tummycrypt_tinyland_scheduled_publishing was merged into this module. The
// ./scheduled-publishing subpath keeps its exact runtime API. The root facade
// does not re-export it: the root already exports a ScheduledPublishingService
// class and a ScheduledItem type from ./scheduling with different shapes.
describe('scheduled publishing merge', () => {
  it('keeps the original runtime API on the ./scheduled-publishing subpath', () => {
    expect(Object.keys(scheduledPublishing).sort()).toEqual([
      'cancelSchedule',
      'configure',
      'createFileBasedService',
      'getCurrentConfig',
      'initializeScheduledPublishing',
      'isInitialized',
      'processScheduledItems',
      'resetConfig',
      'scheduleContent',
      'shutdownScheduledPublishing',
    ]);
  });

  it('declares the ./scheduled-publishing export in package.json', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    expect(manifest.exports['./scheduled-publishing']).toEqual({
      types: './dist/scheduled-publishing/index.d.ts',
      import: './dist/scheduled-publishing/index.js',
    });
  });
});

// The 0.2.2 suite covers only the lifecycle hooks; these pin the file-backed
// store (data/scheduled-publishing.json under process.cwd()).
describe('scheduled publishing file store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tinyland-scheduled-publishing-'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    scheduledPublishing.resetConfig();
    rmSync(dir, { recursive: true, force: true });
  });

  const readStore = () =>
    JSON.parse(readFileSync(join(dir, 'data', 'scheduled-publishing.json'), 'utf8'));

  it('replaces an existing schedule for the same item and cancels it', async () => {
    await scheduledPublishing.scheduleContent('blog', 'a', '2999-01-01T00:00:00Z', 'UTC', false, 'jess');
    await scheduledPublishing.scheduleContent('blog', 'a', '2999-02-01T00:00:00Z', 'UTC', true, 'jess');
    await scheduledPublishing.scheduleContent('blog', 'b', '2999-01-01T00:00:00Z', 'UTC', false, 'jess');
    let items = readStore().items as ScheduledItem[];
    expect(items.map((i) => [i.slug, i.scheduledAt, i.autoFederate])).toEqual([
      ['a', '2999-02-01T00:00:00Z', true],
      ['b', '2999-01-01T00:00:00Z', false],
    ]);

    await scheduledPublishing.cancelSchedule('blog', 'a');
    items = readStore().items as ScheduledItem[];
    expect(items.map((i) => i.slug)).toEqual(['b']);
  });

  it('publishes due items, keeps future ones and retries failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await scheduledPublishing.scheduleContent('blog', 'due', '2000-01-01T00:00:00Z', 'UTC', false, 'jess');
    await scheduledPublishing.scheduleContent('blog', 'fails', '2000-01-01T00:00:00Z', 'UTC', false, 'jess');
    await scheduledPublishing.scheduleContent('blog', 'later', '2999-01-01T00:00:00Z', 'UTC', false, 'jess');

    const onPublish = vi.fn(async (item: ScheduledItem) => {
      if (item.slug === 'fails') throw new Error('boom');
    });
    const published = await scheduledPublishing.processScheduledItems(onPublish);

    expect(published.map((i) => i.slug)).toEqual(['due']);
    expect(onPublish).toHaveBeenCalledTimes(2);
    expect((readStore().items as ScheduledItem[]).map((i) => i.slug)).toEqual(['fails', 'later']);
  });

  it('drives the file-backed service through the lifecycle hooks', async () => {
    vi.useFakeTimers();
    try {
      await scheduledPublishing.scheduleContent('blog', 'due', '2000-01-01T00:00:00Z', 'UTC', false, 'jess');
      const onPublish = vi.fn(async () => undefined);
      const logger = { log: vi.fn(), error: vi.fn() };
      scheduledPublishing.configure({
        service: scheduledPublishing.createFileBasedService(onPublish, logger),
        logger,
      });

      await scheduledPublishing.initializeScheduledPublishing();
      expect(scheduledPublishing.isInitialized()).toBe(true);
      expect(onPublish).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);

      await scheduledPublishing.shutdownScheduledPublishing();
      expect(scheduledPublishing.isInitialized()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
