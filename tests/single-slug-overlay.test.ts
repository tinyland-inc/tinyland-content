// TIN-1952/TIN-1931 regression: the single-slug loaders must resolve a post
// against the SAME bundled+live overlay the listing loaders use. Before the
// fix, findContentBySlug()/loadSingleUserContent() read only the live content
// dir (an empty PVC in prod), so every /blog/[slug] detail page 404ed
// ("Blog post not found") while /blog listed the same bundled posts.
//
// Hardening: the overlay must NOT leak drafts. The by-slug path applies the
// same public gate (published AND public visibility) the listing applies, so a
// bundled-only draft/private post stays a 404 on EVERY public by-slug API;
// auth-gated raw consumers opt in via { includeUnpublished: true }. It must also
// shadow live-over-bundled ACROSS extensions (keyed by slug, not filename).
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
    `visibility: ${extra.visibility ?? 'public'}`,
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

  // (b2) live .mdx shadows a bundled .md of the SAME slug (cross-extension).
  // Regression for the extension-shadowing edge: the overlay is keyed by slug,
  // not filename, so a live foo.mdx overrides a bundled foo.md instead of both
  // surviving. Holds for listing AND by-slug (both use loadFromUserDirectory).
  it('lets a live .mdx shadow a bundled .md of the same slug (keyed by slug, not filename)', async () => {
    const { loadSingleUserContent, findContentBySlug } = await import(
      '../src/loaders/userContentLoader.js'
    );
    const { loadBlogPostsSync } = await import('../src/loaders/blogLoader.js');

    setupMockFs(
      {
        '/test/bundled/users/jess/blog/dispatch.md': post('Bundled MD', 'stale bundled'),
        '/test/content/users/jess/blog/dispatch.mdx': post('Live MDX', 'fresh live'),
      },
      {
        '/test/bundled/users': ['jess'],
        '/test/bundled/users/jess/blog': ['dispatch.md'],
        '/test/content/users': ['jess'],
        '/test/content/users/jess/blog': ['dispatch.mdx'],
      }
    );

    // by-slug: the live .mdx wins; the stale bundled .md does not resurface.
    for (const loaded of [
      loadSingleUserContent('blog', 'dispatch', 'jess'),
      findContentBySlug('blog', 'dispatch'),
    ]) {
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.title).toBe('Live MDX');
      expect(loaded!.content).toContain('fresh live');
      expect(loaded!.filePath).toBe('/test/content/users/jess/blog/dispatch.mdx');
    }

    // listing: exactly one 'dispatch' entry, and it is the live .mdx (no dup).
    const dispatch = loadBlogPostsSync({ handle: 'jess' }).filter(
      (p) => p.slug === 'dispatch'
    );
    expect(dispatch).toHaveLength(1);
    expect(dispatch[0].frontmatter.title).toBe('Live MDX');
  });

  // (c) unpublished/private is NOT resolvable by slug even when bundled — the
  // by-slug path applies the SAME public gate the listing applies. The public
  // API (loadBlogPost et al.) returns null; only auth-gated raw consumers that
  // pass includeUnpublished still see the draft, verbatim (no laundering).
  // Invariant: a by-slug lookup returns a post IFF the public listing includes it.
  describe('by-slug gate matches the public listing (no draft leak)', () => {
    it('hides a private bundled post from EVERY public by-slug API while the raw opt-out still resolves it', async () => {
      const { loadSingleUserContent, findContentBySlug, getUserContentFilePath } =
        await import('../src/loaders/userContentLoader.js');
      const { loadBlogPost, loadBlogPostSync, loadBlogPostsSync } = await import(
        '../src/loaders/blogLoader.js'
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

        // Every exported public by-slug API refuses the private post by default.
        expect(await loadBlogPost('secret')).toBeNull();
        expect(loadBlogPostSync('secret')).toBeNull();
        expect(loadSingleUserContent('blog', 'secret', 'jess')).toBeNull();
        expect(findContentBySlug('blog', 'secret')).toBeNull();
        expect(getUserContentFilePath('blog', 'secret')).toBeNull();

        // ...while the public post still resolves through all of them.
        expect(await loadBlogPost('open')).not.toBeNull();
        expect(loadSingleUserContent('blog', 'open', 'jess')).not.toBeNull();
        expect(findContentBySlug('blog', 'open')).not.toBeNull();

        // The auth-gated raw opt-out (admin/owner preview) still resolves the
        // private post verbatim, visibility preserved (no laundering to public).
        const rawSecret = findContentBySlug('blog', 'secret', {
          includeUnpublished: true,
        });
        expect(rawSecret).not.toBeNull();
        expect(migrateVisibility(rawSecret!.metadata.visibility as string)).toBe(
          'private'
        );
        expect(
          loadSingleUserContent('blog', 'secret', 'jess', { includeUnpublished: true })
        ).not.toBeNull();
        expect(
          getUserContentFilePath('blog', 'secret', { includeUnpublished: true })
        ).toBe('/test/bundled/users/jess/blog/secret.md');

        // Invariant: the anonymous by-slug set == the public listing set.
        const anonVisibleBySlug = ['open', 'secret'].filter(
          (slug) => findContentBySlug('blog', slug) !== null
        );
        expect(anonVisibleBySlug).toEqual(listed); // ['open'] — secret stays hidden
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('hides an unpublished (published:false) bundled post from the public by-slug APIs while the raw opt-out preserves its draft frontmatter', async () => {
      const { findContentBySlug } = await import('../src/loaders/userContentLoader.js');
      const { loadBlogPost, loadBlogPostsSync } = await import(
        '../src/loaders/blogLoader.js'
      );

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

      // The public by-slug APIs hide the draft identically to the listing.
      expect(await loadBlogPost('draft')).toBeNull();
      expect(findContentBySlug('blog', 'draft')).toBeNull();

      // The raw opt-out still resolves the draft, preserving published:false so
      // an auth-gated admin/preview caller can edit it.
      const draft = findContentBySlug('blog', 'draft', { includeUnpublished: true });
      expect(draft).not.toBeNull();
      expect(draft!.metadata.published).toBe(false);
    });
  });
});
