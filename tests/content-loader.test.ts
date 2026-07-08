





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

  // TIN-1952: apex /blog, /@handle/blog and /feed read through the package
  // loader's loadUserContent. On the empty sveltekit-content PVC the live dir
  // is empty; bundledContentDir must back the read so apex is not content-blind,
  // while live (contentDir) wins per handle/slug when both are present.
  describe('loadUserContent bundled-content fallback', () => {
    function post(title: string, body: string): string {
      return [
        '---',
        `title: ${title}`,
        'publishedAt: "2025-01-01"',
        'visibility: public',
        '---',
        body,
      ].join('\n');
    }

    it('returns bundled posts when the live content dir is empty (PVC scenario)', async () => {
      configureContent({
        contentDir: '/test/content',
        bundledContentDir: '/test/bundled',
        dataDir: '/test/data',
      });

      setupMockFs(
        {
          '/test/bundled/users/jess/blog/hello.md': post('Hello', 'bundled body'),
          '/test/bundled/users/jess/blog/world.md': post('World', 'bundled body 2'),
        },
        {
          // live users dir does not exist at all (empty PVC)
          '/test/bundled/users': ['jess'],
          '/test/bundled/users/jess/blog': ['hello.md', 'world.md'],
        }
      );

      const { loadUserContent } = await import('../src/loaders/userContentLoader.js');
      const posts = loadUserContent('blog', { aggregateAll: true });

      expect(posts.length).toBeGreaterThan(0);
      expect(posts).toHaveLength(2);
      expect(posts.map((p) => p.slug).sort()).toEqual(['hello', 'world']);
    });

    it('lets live content win per handle/slug and unions live-only + bundled-only', async () => {
      configureContent({
        contentDir: '/test/content',
        bundledContentDir: '/test/bundled',
        dataDir: '/test/data',
      });

      setupMockFs(
        {
          // shared slug present in both: live must win
          '/test/bundled/users/jess/blog/shared.md': post('Shared Bundled', 'old bundled'),
          '/test/content/users/jess/blog/shared.md': post('Shared Live', 'new live'),
          // bundled-only slug
          '/test/bundled/users/jess/blog/bundled-only.md': post('Bundled Only', 'b'),
          // live-only slug
          '/test/content/users/jess/blog/live-only.md': post('Live Only', 'l'),
        },
        {
          '/test/bundled/users': ['jess'],
          '/test/bundled/users/jess/blog': ['shared.md', 'bundled-only.md'],
          '/test/content/users': ['jess'],
          '/test/content/users/jess/blog': ['shared.md', 'live-only.md'],
        }
      );

      const { loadUserContent } = await import('../src/loaders/userContentLoader.js');
      const posts = loadUserContent('blog', { aggregateAll: true });

      const bySlug = new Map(posts.map((p) => [p.slug, p]));
      expect(posts).toHaveLength(3);
      expect([...bySlug.keys()].sort()).toEqual([
        'bundled-only',
        'live-only',
        'shared',
      ]);
      // live wins for the shared slug
      expect(bySlug.get('shared')!.metadata.title).toBe('Shared Live');
      expect(bySlug.get('shared')!.content).toContain('new live');
      expect(bySlug.get('shared')!.filePath).toBe(
        '/test/content/users/jess/blog/shared.md'
      );
    });

    it('per-handle loader (loadFromUserDirectory) overlays bundled-then-live', async () => {
      configureContent({
        contentDir: '/test/content',
        bundledContentDir: '/test/bundled',
        dataDir: '/test/data',
      });

      setupMockFs(
        {
          '/test/bundled/users/jess/blog/a.md': post('A bundled', 'b'),
          '/test/content/users/jess/blog/a.md': post('A live', 'l'),
          '/test/content/users/jess/blog/b.md': post('B live', 'l2'),
        },
        {
          '/test/bundled/users/jess/blog': ['a.md'],
          '/test/content/users/jess/blog': ['a.md', 'b.md'],
        }
      );

      const { loadUserContent } = await import('../src/loaders/userContentLoader.js');
      const posts = loadUserContent('blog', { handle: 'jess' });

      const bySlug = new Map(posts.map((p) => [p.slug, p]));
      expect(posts).toHaveLength(2);
      expect(bySlug.get('a')!.metadata.title).toBe('A live');
      expect(bySlug.get('b')!.metadata.title).toBe('B live');
    });

    it('no regression when bundledContentDir is not configured (live dir only)', async () => {
      configureContent({
        contentDir: '/test/content',
        dataDir: '/test/data',
      });

      setupMockFs(
        {
          '/test/content/users/jess/blog/only.md': post('Only Live', 'live'),
        },
        {
          '/test/content/users': ['jess'],
          '/test/content/users/jess/blog': ['only.md'],
        }
      );

      const { loadUserContent } = await import('../src/loaders/userContentLoader.js');
      const posts = loadUserContent('blog', { aggregateAll: true });

      expect(posts).toHaveLength(1);
      expect(posts[0].slug).toBe('only');
    });

    it('does not throw when bundledContentDir is configured but missing on disk', async () => {
      configureContent({
        contentDir: '/test/content',
        bundledContentDir: '/test/bundled-missing',
        dataDir: '/test/data',
      });

      setupMockFs(
        {
          '/test/content/users/jess/blog/live.md': post('Live', 'live body'),
        },
        {
          // only the live tree exists; bundled path absent from mockDirs/mockFiles
          '/test/content/users': ['jess'],
          '/test/content/users/jess/blog': ['live.md'],
        }
      );

      const { loadUserContent } = await import('../src/loaders/userContentLoader.js');
      let posts: ReturnType<typeof loadUserContent> = [];
      expect(() => {
        posts = loadUserContent('blog', { aggregateAll: true });
      }).not.toThrow();
      expect(posts).toHaveLength(1);
      expect(posts[0].slug).toBe('live');
    });
  });

  // TIN-1931: the ContentType union gained 'contacts' and 'docs' (#625) so the
  // @[handle]/contact and @[handle]/docs surfaces resolve through the shared
  // package loader. CONTENT_TYPE_DIR_MAP itself was not extended -- these types
  // resolve via its `|| (contentType as ContentType)` identity fallback, so the
  // on-disk directory is content/users/<handle>/{contacts,docs}.
  describe('contacts/docs content types (TIN-1931)', () => {
    it('accepts contacts/docs as ContentType values and maps to their own dir', async () => {
      const { getUserContentDir } =
        await import('../src/loaders/userContentLoader.js');

      const contactsType: import('../src/loaders/userContentLoader.js').ContentType =
        'contacts';
      const docsType: import('../src/loaders/userContentLoader.js').ContentType =
        'docs';

      expect(getUserContentDir('jess', contactsType)).toBe(
        '/test/content/users/jess/contacts'
      );
      expect(getUserContentDir('jess', docsType)).toBe(
        '/test/content/users/jess/docs'
      );
    });

    it('resolves contacts/docs file paths through the DIR_MAP fallback', async () => {
      const { getUserContentFilePathByHandle, findUserContentFilePath } =
        await import('../src/loaders/userContentLoader.js');

      expect(
        getUserContentFilePathByHandle('jess', 'contacts', 'card')
      ).toBe('/test/content/users/jess/contacts/card.md');
      expect(getUserContentFilePathByHandle('jess', 'docs', 'readme')).toBe(
        '/test/content/users/jess/docs/readme.md'
      );

      setupMockFs(
        {
          '/test/content/users/jess/docs/guide.md': [
            '---',
            'title: Guide',
            '---',
            'body',
          ].join('\n'),
        },
        {
          '/test/content/users/jess/docs': ['guide.md'],
        }
      );
      expect(findUserContentFilePath('jess', 'docs', 'guide')).toBe(
        '/test/content/users/jess/docs/guide.md'
      );
    });
  });

  // TIN-1952: ContentServiceConfig gained an optional bundledContentDir (#605);
  // configureContent must round-trip it through getContentConfig.
  describe('bundledContentDir config (TIN-1952)', () => {
    it('round-trips bundledContentDir through configureContent/getContentConfig', async () => {
      const { getContentConfig } = await import('../src/config.js');

      configureContent({
        contentDir: '/test/content',
        bundledContentDir: '/test/bundled',
        dataDir: '/test/data',
      });

      expect(getContentConfig().bundledContentDir).toBe('/test/bundled');
    });

    it('leaves bundledContentDir undefined when not configured', async () => {
      const { getContentConfig } = await import('../src/config.js');

      configureContent({
        contentDir: '/test/content',
        dataDir: '/test/data',
      });

      expect(getContentConfig().bundledContentDir).toBeUndefined();
    });
  });

  describe('migrateVisibility', () => {
    it('should migrate known canonical and legacy values correctly', async () => {
      const { migrateVisibility } = await import('../src/types.js');

      expect(migrateVisibility('public')).toBe('public');
      expect(migrateVisibility('PUBLIC')).toBe('public');
      expect(migrateVisibility('published')).toBe('public');
      expect(migrateVisibility('unlisted')).toBe('unlisted');
      expect(migrateVisibility('members')).toBe('followers');
      expect(migrateVisibility('followers')).toBe('followers');
      expect(migrateVisibility('admin')).toBe('private');
      expect(migrateVisibility('private')).toBe('private');
      expect(migrateVisibility('draft')).toBe('private');
      expect(migrateVisibility('direct')).toBe('direct');
      expect(migrateVisibility(undefined)).toBe('public');
    });

    it('fails closed to private on unknown or typo values', async () => {
      const { migrateVisibility } = await import('../src/types.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        expect(migrateVisibility('unknown-value')).toBe('private');
        expect(migrateVisibility('pubic')).toBe('private');
        expect(migrateVisibility('everyone')).toBe('private');
        expect(migrateVisibility('visible')).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('normalizeProfileVisibility via loadProfiles', () => {
    const profileWith = (visibility?: string) =>
      [
        '---',
        'title: Test User',
        ...(visibility ? [`visibility: ${visibility}`] : []),
        '---',
        'Bio',
      ].join('\n');

    it('excludes profiles with unknown visibility from public listings (fail closed)', async () => {
      const { loadProfiles } = await import('../src/services/ContentLoaderService.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setupMockFs(
        {
          '/test/content/users/gooduser/profile.md': profileWith('public'),
          '/test/content/users/typouser/profile.md': profileWith('pubic'),
        },
        {
          '/test/content/users': ['gooduser', 'typouser'],
        }
      );

      try {
        const items = await loadProfiles();
        expect(items.map((i) => i.authorHandle)).toEqual(['gooduser']);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('normalizes unknown visibility to private, surfaced only with includePrivate', async () => {
      const { loadProfiles } = await import('../src/services/ContentLoaderService.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setupMockFs(
        {
          '/test/content/users/typouser/profile.md': profileWith('pubic'),
        },
        {
          '/test/content/users': ['typouser'],
        }
      );

      try {
        const items = await loadProfiles({ includePrivate: true });
        expect(items).toHaveLength(1);
        expect(items[0].visibility).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps legacy values public through normalizeProfileVisibility', async () => {
      const { loadProfiles } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/legacyuser/profile.md': profileWith('published'),
        },
        {
          '/test/content/users': ['legacyuser'],
        }
      );

      const items = await loadProfiles();
      expect(items).toHaveLength(1);
      expect(items[0].visibility).toBe('public');
    });

    it('defaults missing visibility to public unless published is false', async () => {
      const { loadProfiles } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/defaultuser/profile.md': profileWith(),
        },
        {
          '/test/content/users': ['defaultuser'],
        }
      );

      const items = await loadProfiles();
      expect(items).toHaveLength(1);
      expect(items[0].visibility).toBe('public');
    });
  });

  describe('single-item loaders fail closed (TIN-2656)', () => {
    const postWith = (visibility?: string, extra: string[] = []) =>
      [
        '---',
        'title: Test Post',
        'publishedAt: "2025-01-01"',
        ...(visibility ? [`visibility: ${visibility}`] : []),
        ...extra,
        '---',
        'Body',
      ].join('\n');

    it('loadPostBySlug resolves a typo visibility to private (fail closed)', async () => {
      const { loadPostBySlug } = await import('../src/services/ContentLoaderService.js');
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
        const post = await loadPostBySlug('typo-post');
        expect(post).not.toBeNull();
        expect(post!.visibility).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('loadPostBySlug keeps absent visibility public (absent is NOT unknown)', async () => {
      const { loadPostBySlug } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/testuser/blog/default-post.md': postWith(),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/blog': ['default-post.md'],
        }
      );

      const post = await loadPostBySlug('default-post');
      expect(post).not.toBeNull();
      expect(post!.visibility).toBe('public');
    });

    it('loadPostBySlug keeps legacy published visibility public', async () => {
      const { loadPostBySlug } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/testuser/blog/legacy-post.md': postWith('published'),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/blog': ['legacy-post.md'],
        }
      );

      const post = await loadPostBySlug('legacy-post');
      expect(post).not.toBeNull();
      expect(post!.visibility).toBe('public');
    });

    it('loadEventBySlug resolves typo visibility to private incl. fediverseVisibility', async () => {
      const { loadEventBySlug } = await import('../src/services/ContentLoaderService.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setupMockFs(
        {
          '/test/content/users/testuser/events/typo-event.md': postWith('privte'),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/events': ['typo-event.md'],
        }
      );

      try {
        const event = await loadEventBySlug('typo-event');
        expect(event).not.toBeNull();
        expect(event!.visibility).toBe('private');
        expect(event!.fediverseVisibility).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('loadEventBySlug keeps absent visibility public with undefined fediverseVisibility', async () => {
      const { loadEventBySlug } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/testuser/events/default-event.md': postWith(),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/events': ['default-event.md'],
        }
      );

      const event = await loadEventBySlug('default-event');
      expect(event).not.toBeNull();
      expect(event!.visibility).toBe('public');
      expect(event!.fediverseVisibility).toBeUndefined();
    });
  });

  describe('listing loaders fail closed (TIN-2656)', () => {
    const postWith = (visibility?: string, extra: string[] = []) =>
      [
        '---',
        'title: Test Post',
        'publishedAt: "2025-01-01"',
        ...(visibility ? [`visibility: ${visibility}`] : []),
        ...extra,
        '---',
        'Body',
      ].join('\n');

    it('excludes typo-visibility posts from public listings, surfaces as private with includePrivate', async () => {
      const { loadBlogPosts } = await import('../src/services/ContentLoaderService.js');
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
        const publicOnly = await loadBlogPosts({ handle: 'testuser' });
        expect(publicOnly.map((p) => p.slug)).toEqual(['good-post']);

        const withPrivate = await loadBlogPosts({
          handle: 'testuser',
          includePrivate: true,
        });
        const typoPost = withPrivate.find((p) => p.slug === 'typo-post');
        expect(typoPost).toBeDefined();
        expect(typoPost!.visibility).toBe('private');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps legacy published visibility posts in public listings', async () => {
      const { loadBlogPosts } = await import('../src/services/ContentLoaderService.js');

      setupMockFs(
        {
          '/test/content/users/testuser/blog/legacy-post.md': postWith('published'),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/blog': ['legacy-post.md'],
        }
      );

      const posts = await loadBlogPosts({ handle: 'testuser' });
      expect(posts).toHaveLength(1);
      expect(posts[0].visibility).toBe('public');
    });

    it('federatedOnly excludes typo fediverse visibility (fail closed) but keeps absent public', async () => {
      const { loadEvents } = await import('../src/services/ContentLoaderService.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setupMockFs(
        {
          '/test/content/users/testuser/events/open-event.md': postWith(),
          '/test/content/users/testuser/events/typo-event.md': postWith(
            'public',
            ['fediverseVisibility: privte']
          ),
        },
        {
          '/test/content/users': ['testuser'],
          '/test/content/users/testuser/events': ['open-event.md', 'typo-event.md'],
        }
      );

      try {
        const federated = await loadEvents({
          handle: 'testuser',
          federatedOnly: true,
        });
        expect(federated.map((e) => e.slug)).toEqual(['open-event']);
        expect(federated[0].visibility).toBe('public');
        expect(federated[0].fediverseVisibility).toBe('public');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
