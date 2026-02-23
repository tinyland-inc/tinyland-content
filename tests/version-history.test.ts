





import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureContent, resetContentConfig } from '../src/config.js';


const fsStore: Record<string, string> = {};
const fsDirs: Set<string> = new Set();

function clearFsStore() {
  for (const key of Object.keys(fsStore)) {
    delete fsStore[key];
  }
  fsDirs.clear();
}


vi.mock('fs/promises', () => ({
  mkdir: vi.fn(async (dirPath: string) => {
    fsDirs.add(dirPath);
  }),
  readFile: vi.fn(async (filePath: string) => {
    const content = fsStore[filePath];
    if (content === undefined) throw new Error(`ENOENT: ${filePath}`);
    return content;
  }),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    fsStore[filePath] = content;
  }),
  unlink: vi.fn(async (filePath: string) => {
    delete fsStore[filePath];
  }),
  rm: vi.fn(async (dirPath: string) => {
    for (const key of Object.keys(fsStore)) {
      if (key.startsWith(dirPath)) {
        delete fsStore[key];
      }
    }
  }),
  access: vi.fn(async (filePath: string) => {
    if (!(filePath in fsStore)) throw new Error('ENOENT');
  }),
}));

describe('VersionHistoryService', () => {
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
    const { createVersionHistory } = await import('../src/versioning/index.js');
    return createVersionHistory();
  }

  describe('saveVersion', () => {
    it('should save a first version with version number 1', async () => {
      const service = await getService();
      const version = await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Test Post' },
        'Hello world',
        'create',
        'testuser'
      );

      expect(version.version).toBe(1);
      expect(version.contentType).toBe('blog');
      expect(version.slug).toBe('test-post');
      expect(version.changeType).toBe('create');
      expect(version.createdBy).toBe('testuser');
      expect(version.content).toBe('Hello world');
      expect(version.frontmatter.title).toBe('Test Post');
      expect(version.id).toBeTruthy();
      expect(version.createdAt).toBeTruthy();
      expect(version.diff).toBeUndefined();
    });

    it('should increment version numbers', async () => {
      const service = await getService();

      const v1 = await service.saveVersion(
        'blog',
        'test-post',
        { title: 'V1' },
        'Content v1',
        'create',
        'testuser'
      );

      const v2 = await service.saveVersion(
        'blog',
        'test-post',
        { title: 'V2' },
        'Content v2',
        'edit',
        'testuser'
      );

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
    });

    it('should generate diff for subsequent versions', async () => {
      const service = await getService();

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Original Title' },
        'Original content',
        'create',
        'testuser'
      );

      const v2 = await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Updated Title' },
        'Updated content',
        'edit',
        'testuser'
      );

      expect(v2.diff).toBeDefined();
      expect(v2.diff!.frontmatterDiff).toHaveProperty('title');
      expect(v2.diff!.frontmatterDiff.title.old).toBe('Original Title');
      expect(v2.diff!.frontmatterDiff.title.new).toBe('Updated Title');
      expect(v2.diff!.contentDiff).toContain('Original content');
      expect(v2.diff!.contentDiff).toContain('Updated content');
    });
  });

  describe('getVersion', () => {
    it('should return null for non-existent version', async () => {
      const service = await getService();
      const version = await service.getVersion('blog', 'nonexistent', 1);
      expect(version).toBeNull();
    });

    it('should retrieve a saved version', async () => {
      const service = await getService();

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Test' },
        'Content',
        'create',
        'testuser'
      );

      const version = await service.getVersion('blog', 'test-post', 1);
      expect(version).not.toBeNull();
      expect(version!.version).toBe(1);
      expect(version!.frontmatter.title).toBe('Test');
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and generate diffs', async () => {
      const service = await getService();

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'V1 Title', tags: ['a'] },
        'Version 1 content',
        'create',
        'testuser'
      );

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'V2 Title', tags: ['a', 'b'] },
        'Version 2 content',
        'edit',
        'testuser'
      );

      const comparison = await service.compareVersions(
        'blog',
        'test-post',
        1,
        2
      );

      expect(comparison.from.version).toBe(1);
      expect(comparison.to.version).toBe(2);
      expect(comparison.frontmatterDiff).toHaveProperty('title');
      expect(comparison.contentDiff).toContain('Version 1 content');
      expect(comparison.contentDiff).toContain('Version 2 content');
    });

    it('should throw for non-existent version', async () => {
      const service = await getService();

      await expect(
        service.compareVersions('blog', 'nonexistent', 1, 2)
      ).rejects.toThrow('Version not found');
    });
  });

  describe('restoreVersion', () => {
    it('should create a new version from an old one', async () => {
      const service = await getService();

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Original' },
        'Original content',
        'create',
        'testuser'
      );

      await service.saveVersion(
        'blog',
        'test-post',
        { title: 'Changed' },
        'Changed content',
        'edit',
        'testuser'
      );

      const restored = await service.restoreVersion(
        'blog',
        'test-post',
        1,
        'testuser'
      );

      expect(restored.version).toBe(3);
      expect(restored.changeType).toBe('restore');
      expect(restored.frontmatter.title).toBe('Original');
      expect(restored.content).toBe('Original content');
      expect(restored.changeSummary).toContain('Restored from version 1');
    });
  });

  describe('getVersionStats', () => {
    it('should return empty stats for no versions', async () => {
      const service = await getService();
      const stats = await service.getVersionStats('blog', 'nonexistent');

      expect(stats.totalVersions).toBe(0);
      expect(stats.oldestVersion).toBeNull();
      expect(stats.newestVersion).toBeNull();
      expect(stats.changeTypeCounts).toEqual({});
    });

    it('should return correct stats', async () => {
      const service = await getService();

      await service.saveVersion('blog', 'test-post', { title: 'V1' }, 'Content', 'create', 'testuser');
      await service.saveVersion('blog', 'test-post', { title: 'V2' }, 'Content', 'edit', 'testuser');
      await service.saveVersion('blog', 'test-post', { title: 'V3' }, 'Content', 'edit', 'testuser');

      const stats = await service.getVersionStats('blog', 'test-post');

      expect(stats.totalVersions).toBe(3);
      expect(stats.oldestVersion!.version).toBe(1);
      expect(stats.newestVersion!.version).toBe(3);
      expect(stats.changeTypeCounts).toEqual({
        create: 1,
        edit: 2,
      });
    });
  });
});
