





import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureContent, resetContentConfig } from '../src/config.js';


const mockFiles: Record<string, string> = {};
const mockDirs: Record<string, string[]> = {};

function clearMockFs() {
  for (const key of Object.keys(mockFiles)) delete mockFiles[key];
  for (const key of Object.keys(mockDirs)) delete mockDirs[key];
}

function setupMockFs(files: Record<string, string>, dirs: Record<string, string[]>) {
  clearMockFs();
  Object.assign(mockFiles, files);
  Object.assign(mockDirs, dirs);
}


vi.mock('fs', () => ({
  readFileSync: vi.fn((filePath: string) => {
    const content = mockFiles[filePath];
    if (content === undefined) throw new Error(`ENOENT: no such file: ${filePath}`);
    return content;
  }),
  existsSync: vi.fn((filePath: string) => {
    return filePath in mockFiles || filePath in mockDirs;
  }),
  readdirSync: vi.fn((dirPath: string, options?: { withFileTypes: boolean }) => {
    const entries = mockDirs[dirPath];
    if (!entries) return [];
    if (options?.withFileTypes) {
      return entries.map((name) => ({
        name,
        isDirectory: () => !name.includes('.'),
      }));
    }
    return entries;
  }),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('ContentLoaderService', () => {
  beforeEach(() => {
    configureContent({
      contentDir: '/test/content',
      dataDir: '/test/data',
    });
    clearMockFs();
  });

  afterEach(() => {
    resetContentConfig();
    vi.clearAllMocks();
  });

  describe('loadBlogPosts', () => {
    it('should load blog posts from user directories', async () => {
      const mdContent = [
        '---',
        'title: Test Post',
        'publishedAt: "2025-01-01"',
        'visibility: public',
        '---',
        'Hello world',
      ].join('\n');

      setupMockFs(
        {
          '/test/content/users/testuser/blog/test-post.md': mdContent,
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/blog': ['test-post.md'],
        }
      );

      const { loadBlogPosts } = await import('../src/services/ContentLoaderService.js');
      const posts = await loadBlogPosts({ handle: 'testuser' });

      expect(posts).toHaveLength(1);
      expect(posts[0].slug).toBe('test-post');
      expect(posts[0].type).toBe('blog-post');
      expect(posts[0].metadata.title).toBe('Test Post');
      expect(posts[0].content).toContain('Hello world');
      expect(posts[0].authorHandle).toBe('testuser');
    });

    it('should filter by visibility', async () => {
      const publicPost = [
        '---',
        'title: Public Post',
        'publishedAt: "2025-01-01"',
        'visibility: public',
        '---',
        'Public content',
      ].join('\n');

      const privatePost = [
        '---',
        'title: Private Post',
        'publishedAt: "2025-01-02"',
        'visibility: private',
        '---',
        'Private content',
      ].join('\n');

      setupMockFs(
        {
          '/test/content/users/testuser/blog/public-post.md': publicPost,
          '/test/content/users/testuser/blog/private-post.md': privatePost,
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/blog': [
            'private-post.md',
            'public-post.md',
          ],
        }
      );

      const { loadBlogPosts } = await import('../src/services/ContentLoaderService.js');

      const publicOnly = await loadBlogPosts({ handle: 'testuser' });
      expect(publicOnly).toHaveLength(1);
      expect(publicOnly[0].slug).toBe('public-post');

      const withPrivate = await loadBlogPosts({
        handle: 'testuser',
        includePrivate: true,
      });
      expect(withPrivate).toHaveLength(2);
    });

    it('should return empty array for non-existent directory', async () => {
      setupMockFs({}, {});

      const { loadBlogPosts } = await import('../src/services/ContentLoaderService.js');
      const posts = await loadBlogPosts({ handle: 'nonexistent' });

      expect(posts).toHaveLength(0);
    });
  });

  describe('loadPostBySlug', () => {
    it('should load a single post by slug', async () => {
      const mdContent = [
        '---',
        'title: Found Post',
        'publishedAt: "2025-06-01"',
        '---',
        'Found content',
      ].join('\n');

      setupMockFs(
        {
          '/test/content/users/alice/blog/found-post.md': mdContent,
        },
        {
          '/test/content/users': ['alice'],
          '/test/content/users/alice/blog': ['found-post.md'],
        }
      );

      const { loadPostBySlug } = await import('../src/services/ContentLoaderService.js');
      const post = await loadPostBySlug('found-post');

      expect(post).not.toBeNull();
      expect(post!.slug).toBe('found-post');
      expect(post!.metadata.title).toBe('Found Post');
      expect(post!.authorHandle).toBe('alice');
    });

    it('should return null for non-existent slug', async () => {
      setupMockFs({}, { '/test/content/users': [] });

      const { loadPostBySlug } = await import('../src/services/ContentLoaderService.js');
      const post = await loadPostBySlug('nonexistent');

      expect(post).toBeNull();
    });
  });

  describe('extractAuthorHandle', () => {
    it('should extract handle from object author', async () => {
      const { extractAuthorHandle } = await import('../src/services/ContentLoaderService.js');

      expect(
        extractAuthorHandle({
          author: { handle: 'test_user', name: 'Test User' },
        })
      ).toBe('test_user');
    });

    it('should extract handle from string author (legacy)', async () => {
      const { extractAuthorHandle } = await import('../src/services/ContentLoaderService.js');

      expect(extractAuthorHandle({ author: 'legacy_user' })).toBe('legacy_user');
    });

    it('should fall back to unknown', async () => {
      const { extractAuthorHandle } = await import('../src/services/ContentLoaderService.js');

      expect(extractAuthorHandle({})).toBe('unknown');
    });
  });

  describe('migrateVisibility', () => {
    it('should migrate legacy values correctly', async () => {
      const { migrateVisibility } = await import('../src/types.js');

      expect(migrateVisibility('public')).toBe('public');
      expect(migrateVisibility('published')).toBe('public');
      expect(migrateVisibility('members')).toBe('followers');
      expect(migrateVisibility('admin')).toBe('private');
      expect(migrateVisibility('private')).toBe('private');
      expect(migrateVisibility('draft')).toBe('private');
      expect(migrateVisibility('direct')).toBe('direct');
      expect(migrateVisibility(undefined)).toBe('public');
      expect(migrateVisibility('unknown-value')).toBe('public');
    });
  });
});
