





import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureContent, resetContentConfig } from '../src/config.js';


const fsStore: Record<string, string> = {};

function clearFsStore() {
  for (const key of Object.keys(fsStore)) {
    delete fsStore[key];
  }
}


vi.mock('fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  readFile: vi.fn(async (filePath: string) => {
    const content = fsStore[filePath];
    if (content === undefined) throw new Error(`ENOENT: ${filePath}`);
    return content;
  }),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    fsStore[filePath] = content;
  }),
  access: vi.fn(async (filePath: string) => {
    if (!(filePath in fsStore)) throw new Error('ENOENT');
  }),
  unlink: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
}));


vi.mock('node-cron', () => {
  throw new Error('node-cron not available');
});

describe('ScheduledPublishingService', () => {
  beforeEach(() => {
    configureContent({
      contentDir: '/test/content',
      dataDir: '/test/data',
    });
    clearFsStore();
  });

  afterEach(() => {
    resetContentConfig();
    vi.clearAllMocks();
  });

  async function getService() {
    const { createScheduledPublisher } = await import('../src/scheduling/index.js');
    return createScheduledPublisher();
  }

  describe('scheduleContent', () => {
    it('should schedule a content item', async () => {
      const service = await getService();
      await service.initialize();

      const item = await service.scheduleContent(
        'blog',
        'my-post',
        '2025-12-01T00:00:00Z',
        'America/New_York',
        false,
        'testuser'
      );

      expect(item.contentType).toBe('blog');
      expect(item.slug).toBe('my-post');
      expect(item.scheduledAt).toBe('2025-12-01T00:00:00Z');
      expect(item.timezone).toBe('America/New_York');
      expect(item.autoFederate).toBe(false);
      expect(item.createdBy).toBe('testuser');
      expect(item.id).toBeTruthy();
    });

    it('should update existing schedule', async () => {
      const service = await getService();
      await service.initialize();

      const first = await service.scheduleContent(
        'blog',
        'my-post',
        '2025-12-01T00:00:00Z',
        'America/New_York',
        false,
        'testuser'
      );

      const updated = await service.scheduleContent(
        'blog',
        'my-post',
        '2025-12-15T00:00:00Z',
        'America/New_York',
        true,
        'testuser'
      );

      expect(updated.id).toBe(first.id);
      expect(updated.scheduledAt).toBe('2025-12-15T00:00:00Z');
      expect(updated.autoFederate).toBe(true);
    });
  });

  describe('cancelSchedule', () => {
    it('should remove a scheduled item', async () => {
      const service = await getService();
      await service.initialize();

      await service.scheduleContent(
        'blog',
        'my-post',
        '2025-12-01T00:00:00Z',
        'UTC',
        false,
        'testuser'
      );

      const removed = await service.cancelSchedule('blog', 'my-post');
      expect(removed).toBe(true);

      const items = await service.getScheduledItems();
      expect(items).toHaveLength(0);
    });

    it('should return false for non-existent item', async () => {
      const service = await getService();
      await service.initialize();

      const removed = await service.cancelSchedule('blog', 'nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getScheduledItems', () => {
    it('should return items sorted by scheduled time', async () => {
      const service = await getService();
      await service.initialize();

      await service.scheduleContent(
        'blog',
        'post-b',
        '2025-12-15T00:00:00Z',
        'UTC',
        false,
        'testuser'
      );

      await service.scheduleContent(
        'blog',
        'post-a',
        '2025-12-01T00:00:00Z',
        'UTC',
        false,
        'testuser'
      );

      const items = await service.getScheduledItems();

      expect(items).toHaveLength(2);
      expect(items[0].slug).toBe('post-a');
      expect(items[1].slug).toBe('post-b');
    });
  });

  describe('getScheduledItem', () => {
    it('should return a specific scheduled item', async () => {
      const service = await getService();
      await service.initialize();

      await service.scheduleContent(
        'blog',
        'target-post',
        '2025-12-01T00:00:00Z',
        'UTC',
        true,
        'testuser'
      );

      const item = await service.getScheduledItem('blog', 'target-post');
      expect(item).not.toBeNull();
      expect(item!.slug).toBe('target-post');
      expect(item!.autoFederate).toBe(true);
    });

    it('should return null for non-existent item', async () => {
      const service = await getService();
      await service.initialize();

      const item = await service.getScheduledItem('blog', 'nonexistent');
      expect(item).toBeNull();
    });
  });

  describe('publish hooks', () => {
    it('should accept hooks via setHooks', async () => {
      const service = await getService();
      const onPublish = vi.fn();
      const onUnpublish = vi.fn();

      service.setHooks({ onPublish, onUnpublish });
      
    });

    it('should accept hooks via factory', async () => {
      const { createScheduledPublisher } = await import('../src/scheduling/index.js');
      const onPublish = vi.fn();
      const svc = createScheduledPublisher({ onPublish });

      expect(svc).toBeDefined();
    });
  });

  describe('publish hook visibility normalization (TIN-2656)', () => {
    it('hands federation hooks private for typo visibility (fail closed)', async () => {
      const service = await getService();
      await service.initialize();

      const seen: Array<{ visibility: string }> = [];
      service.setHooks({
        onPublish: async (item) => {
          seen.push({ visibility: item.visibility });
        },
      });

      await service.scheduleContent(
        'blog',
        'typo-post',
        '2020-01-01T00:00:00Z',
        'UTC',
        true,
        'testuser'
      );

      fsStore['/test/content/blog/typo-post.md'] = [
        '---',
        'title: Typo Post',
        'visibility: pubic',
        '---',
        'Body',
      ].join('\n');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const results = await service.processScheduledItems();
        expect(results).toHaveLength(1);
        expect(results[0].federated).toBe(true);
        expect(seen).toHaveLength(1);
        expect(seen[0].visibility).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps absent visibility public through publish hooks', async () => {
      const service = await getService();
      await service.initialize();

      const seen: Array<{ visibility: string }> = [];
      service.setHooks({
        onPublish: async (item) => {
          seen.push({ visibility: item.visibility });
        },
      });

      await service.scheduleContent(
        'blog',
        'default-post',
        '2020-01-01T00:00:00Z',
        'UTC',
        true,
        'testuser'
      );

      fsStore['/test/content/blog/default-post.md'] = [
        '---',
        'title: Default Post',
        '---',
        'Body',
      ].join('\n');

      const results = await service.processScheduledItems();
      expect(results).toHaveLength(1);
      expect(results[0].federated).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0].visibility).toBe('public');
    });
  });

  describe('processScheduledItems', () => {
    it('should process due items', async () => {
      const service = await getService();
      await service.initialize();

      await service.scheduleContent(
        'blog',
        'past-post',
        '2020-01-01T00:00:00Z',
        'UTC',
        false,
        'testuser'
      );

      
      const contentFilePath = '/test/content/blog/past-post.md';
      fsStore[contentFilePath] = [
        '---',
        'title: Past Post',
        'status: draft',
        '---',
        'Content here',
      ].join('\n');

      const results = await service.processScheduledItems();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].slug).toBe('past-post');
      expect(results[0].federated).toBe(false);
    });

    it('should not process future items', async () => {
      const service = await getService();
      await service.initialize();

      await service.scheduleContent(
        'blog',
        'future-post',
        '2099-01-01T00:00:00Z',
        'UTC',
        false,
        'testuser'
      );

      const results = await service.processScheduledItems();
      expect(results).toHaveLength(0);

      const items = await service.getScheduledItems();
      expect(items).toHaveLength(1);
    });
  });

  describe('shutdown', () => {
    it('should shut down cleanly', async () => {
      const service = await getService();
      await service.initialize();
      await service.shutdown();
      
    });
  });
});
