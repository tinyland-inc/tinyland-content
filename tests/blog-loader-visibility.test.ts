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

describe('blogLoader visibility filter fails closed (TIN-2656)', () => {
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

  const postWith = (visibility?: string) =>
    [
      '---',
      'title: Test Post',
      'author: testuser',
      'publishedAt: "2025-01-01"',
      ...(visibility ? [`visibility: ${visibility}`] : []),
      '---',
      'Body',
    ].join('\n');

  it('excludes typo-visibility posts from a public visibility filter', async () => {
    const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setupMockFs(
      {
        '/test/content/users/testuser/blog/good-post.md': postWith('public'),
        '/test/content/users/testuser/blog/typo-post.md': postWith('pubic'),
      },
      {
        '/test/content/users': ['testuser'],
        '/test/content/users/testuser/blog': ['good-post.md', 'typo-post.md'],
      }
    );

    try {
      const posts = loadBlogPostsSync({
        handle: 'testuser',
        visibility: ['public'],
      });
      expect(posts.map((p) => p.slug)).toEqual(['good-post']);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('surfaces typo-visibility posts only under a private visibility filter', async () => {
    const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setupMockFs(
      {
        '/test/content/users/testuser/blog/typo-post.md': postWith('pubic'),
      },
      {
        '/test/content/users': ['testuser'],
        '/test/content/users/testuser/blog': ['typo-post.md'],
      }
    );

    try {
      const posts = loadBlogPostsSync({
        handle: 'testuser',
        visibility: ['private'],
      });
      expect(posts.map((p) => p.slug)).toEqual(['typo-post']);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('keeps legacy published public and defaults absent visibility to private', async () => {
    const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');

    setupMockFs(
      {
        '/test/content/users/testuser/blog/legacy-post.md': postWith('published'),
        '/test/content/users/testuser/blog/default-post.md': postWith(),
      },
      {
        '/test/content/users': ['testuser'],
        '/test/content/users/testuser/blog': ['default-post.md', 'legacy-post.md'],
      }
    );

    const posts = loadBlogPostsSync({
      handle: 'testuser',
      visibility: ['public'],
    });
    expect(posts.map((p) => p.slug)).toEqual(['legacy-post']);

    const privatePosts = loadBlogPostsSync({
      handle: 'testuser',
      visibility: ['private'],
    });
    expect(privatePosts.map((p) => p.slug)).toEqual(['default-post']);
  });
});
