// TIN-1952/TIN-1931 regression: the single-slug loaders must resolve a post
// against the SAME bundled+live overlay the listing loaders use. Before the
// fix, findContentBySlug()/loadSingleUserContent() read only the live content
// dir (an empty PVC in prod), so every /blog/[slug] detail page 404ed
// ("Blog post not found") while /blog listed the same bundled posts.
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

function post(
  title: string,
  body: string,
  extra: { visibility?: string; published?: boolean } = {}
): string {
  return [
    '---',
    `title: ${title}`,
    'author: jess',
    'publishedAt: "2025-01-01"',
    ...(extra.visibility ? [`visibility: ${extra.visibility}`] : []),
    ...(extra.published === false ? ['published: false'] : []),
    '---',
    body,
  ].join('\n');
}

describe('single-slug loaders share the listing bundled+live overlay (TIN-1952)', () => {
  beforeEach(() => {
    configureContent({
      contentDir: '/test/content',
      bundledContentDir: '/test/bundled',
      dataDir: '/test/data',
    });
    clearMockFs();
  });

  afterEach(() => {
    resetContentConfig();
    vi.clearAllMocks();
  });

  // (a) bundled-only post resolves by slug when the live dir is empty (PVC).
  it('resolves a bundled-only post by slug when the live content dir is empty', async () => {
    const { loadSingleUserContent, findContentBySlug } = await import(
      '../src/loaders/userContentLoader.js'
    );

    setupMockFs(
      {
        '/test/bundled/users/jess/blog/hello.md': post('Hello', 'bundled body'),
      },
      {
        // NOTE: the live users dir does not exist at all (empty PVC). The old
        // findContentBySlug bailed on existsSync(liveUsersDir) and returned null.
        '/test/bundled/users': ['jess'],
        '/test/bundled/users/jess/blog': ['hello.md'],
      }
    );

    const byHandle = loadSingleUserContent('blog', 'hello', 'jess');
    expect(byHandle).not.toBeNull();
    expect(byHandle!.slug).toBe('hello');
    expect(byHandle!.filePath).toBe('/test/bundled/users/jess/blog/hello.md');
    expect(byHandle!.content).toContain('bundled body');

    const anyHandle = findContentBySlug('blog', 'hello');
    expect(anyHandle).not.toBeNull();
    expect(anyHandle!.slug).toBe('hello');
    expect(anyHandle!.ownerHandle).toBe('jess');
    expect(anyHandle!.filePath).toBe('/test/bundled/users/jess/blog/hello.md');
  });

  // (b) live post shadows a bundled post of the same slug (live wins).
  it('lets the live post shadow a bundled same-slug post (live wins by slug)', async () => {
    const { loadSingleUserContent, findContentBySlug } = await import(
      '../src/loaders/userContentLoader.js'
    );

    setupMockFs(
      {
        '/test/bundled/users/jess/blog/shared.md': post('Shared Bundled', 'old bundled'),
        '/test/content/users/jess/blog/shared.md': post('Shared Live', 'new live'),
        // a bundled-only and a live-only slug must both still resolve
        '/test/bundled/users/jess/blog/bundled-only.md': post('Bundled Only', 'b'),
        '/test/content/users/jess/blog/live-only.md': post('Live Only', 'l'),
      },
      {
        '/test/bundled/users': ['jess'],
        '/test/bundled/users/jess/blog': ['shared.md', 'bundled-only.md'],
        '/test/content/users': ['jess'],
        '/test/content/users/jess/blog': ['shared.md', 'live-only.md'],
      }
    );

    for (const loaded of [
      loadSingleUserContent('blog', 'shared', 'jess'),
      findContentBySlug('blog', 'shared'),
    ]) {
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.title).toBe('Shared Live');
      expect(loaded!.content).toContain('new live');
      expect(loaded!.filePath).toBe('/test/content/users/jess/blog/shared.md');
    }

    expect(findContentBySlug('blog', 'bundled-only')!.content).toContain('b');
    expect(findContentBySlug('blog', 'live-only')!.content).toContain('l');
  });

  // (c) unpublished/private stays hidden by slug even when bundled — the same
  // shared gate that hides it from the listing hides it on the by-slug surface,
  // and the overlay does not launder a private bundled post into public.
  describe('visibility/published gating stays identical to listing behavior', () => {
    it('keeps a private bundled post hidden by slug exactly as the public listing hides it', async () => {
      const { findContentBySlug } = await import('../src/loaders/userContentLoader.js');
      const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');
      const { shouldIncludeByVisibility } = await import(
        '../src/services/ContentLoaderService.js'
      );
      const { migrateVisibility } = await import('../src/types.js');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setupMockFs(
        {
          '/test/bundled/users/jess/blog/open.md': post('Open', 'x', {
            visibility: 'public',
          }),
          '/test/bundled/users/jess/blog/secret.md': post('Secret', 'y', {
            visibility: 'private',
          }),
        },
        {
          // live PVC empty; both posts exist only in the bundled baseline
          '/test/bundled/users': ['jess'],
          '/test/bundled/users/jess/blog': ['open.md', 'secret.md'],
        }
      );

      try {
        // The public listing surface (what /blog renders) hides the private post.
        const listed = loadBlogPostsSync({ handle: 'jess', visibility: ['public'] })
          .map((p) => p.slug)
          .sort();
        expect(listed).toEqual(['open']);

        // The overlay itself is NOT a visibility filter: the private post is
        // still resolvable by slug (so this is a gate, not a 404), but it
        // carries its private visibility unchanged — no laundering to public.
        const secret = findContentBySlug('blog', 'secret');
        expect(secret).not.toBeNull();
        expect(migrateVisibility(secret!.metadata.visibility as string)).toBe('private');

        // The shared object gate (used by the per-object AP/detail surface) must
        // reach the same verdict as the listing for every slug: the set of slugs
        // an anonymous by-slug fetch may surface == the public listing set.
        const anonVisibleBySlug = ['open', 'secret'].filter((slug) => {
          const c = findContentBySlug('blog', slug);
          if (!c) return false;
          const v = migrateVisibility(c.metadata.visibility as string);
          return shouldIncludeByVisibility(v, {});
        });
        expect(anonVisibleBySlug).toEqual(listed); // ['open'] — secret stays hidden
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps an unpublished (published:false) bundled post out of the published-only listing while still surfacing its draft frontmatter by slug', async () => {
      const { findContentBySlug } = await import('../src/loaders/userContentLoader.js');
      const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');

      setupMockFs(
        {
          '/test/bundled/users/jess/blog/live-post.md': post('Live Post', 'x'),
          '/test/bundled/users/jess/blog/draft.md': post('Draft', 'y', {
            published: false,
          }),
        },
        {
          '/test/bundled/users': ['jess'],
          '/test/bundled/users/jess/blog': ['live-post.md', 'draft.md'],
        }
      );

      // publishedOnly listing excludes the draft (parity with the public surface).
      const published = loadBlogPostsSync({ handle: 'jess', publishedOnly: true })
        .map((p) => p.slug)
        .sort();
      expect(published).toEqual(['live-post']);

      // The overlay still resolves the draft by slug, preserving published:false
      // so a publishedOnly-gated caller can hide it identically to the listing.
      const draft = findContentBySlug('blog', 'draft');
      expect(draft).not.toBeNull();
      expect(draft!.metadata.published).toBe(false);
    });
  });
});
