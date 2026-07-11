










import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig } from '../config.js';
import type { LoadedContent, LoadOptions } from '../types.js';
import { migrateVisibility } from '../types.js';





export type ContentType =
  | 'blog'
  | 'products'
  | 'events'
  | 'programs'
  | 'notes'
  | 'videos'
  | 'gallery'
  | 'stacks'
  | 'contacts'
  | 'docs';





function getContentBase(): string {
  return getContentConfig().contentDir;
}

function getUsersDir(): string {
  return join(getContentBase(), 'users');
}




function getBundledBase(): string | undefined {
  return getContentConfig().bundledContentDir;
}

function getBundledUsersDir(): string | undefined {
  const base = getBundledBase();
  return base ? join(base, 'users') : undefined;
}




export function getUserContentDir(
  handle: string,
  contentType: ContentType
): string {
  return join(getUsersDir(), handle, contentType);
}




export function getUserBaseDir(handle: string): string {
  return join(getUsersDir(), handle);
}




export function getUserProfilePath(handle: string): string {
  return join(getUsersDir(), handle, 'profile.md');
}




export function userDirectoryExists(handle: string): boolean {
  return existsSync(getUserBaseDir(handle));
}




export function getAllUserHandles(): string[] {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return [];
  }

  return readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}


















export function loadUserContent(
  contentType: ContentType,
  options: LoadOptions = {}
): LoadedContent[] {
  const { handle, aggregateAll = false, extensions = ['.md', '.mdx'] } =
    options;

  if (handle) {
    return loadFromUserDirectory(handle, contentType, extensions);
  } else if (aggregateAll) {
    return loadFromAllUserDirectories(contentType, extensions);
  }

  return [];
}




/**
 * Gate options for the by-slug loaders.
 *
 * The by-slug loaders are fail-closed by default: they return a post ONLY IF
 * the public listing would include it (published AND public visibility). This
 * is the org no-auto-publish invariant. Before the bundled+live overlay landed
 * (TIN-1952) a bundled-only draft/private post 404ed on an empty prod PVC; the
 * overlay made it raw-resolvable by slug, so without this gate the fix would
 * have turned that 404 into a draft leak. The gate restores the invariant:
 * a by-slug lookup returns a post IFF the public listing would include it.
 *
 * `includeUnpublished` is the explicit raw opt-out for auth-gated internal
 * consumers that legitimately need drafts / non-public content: the member &
 * admin edit + preview surfaces (admin/<type>/edit, duplicate-slug checks), owner
 * self-preview on @[handle]/… detail routes, and the scheduling / bulk file-path
 * resolvers (scheduling a draft must first resolve it). When true the loader
 * skips the gate and returns the post even if it is unpublished
 * (published:false / draft:true) or non-public (private/unlisted/followers/
 * direct). Public request paths MUST leave it unset so unpublished content
 * stays a 404.
 */
export interface SingleContentOptions {
  includeUnpublished?: boolean;
}

/**
 * The by-slug public-surface gate. Mirrors the /blog/[slug] route gate and the
 * gated listing (visibility:['public'] + publishedOnly): a post is surfaced iff
 * it is published (not published:false / draft:true) AND its fail-closed
 * normalized visibility is 'public'. Raw consumers bypass via includeUnpublished.
 */
function passesBySlugGate(
  metadata: Record<string, unknown>,
  options: SingleContentOptions
): boolean {
  if (options.includeUnpublished) {
    return true;
  }

  const published = metadata.published !== false && metadata.draft !== true;
  if (!published) {
    return false;
  }

  return (
    migrateVisibility(metadata.visibility as string | null | undefined) === 'public'
  );
}


export function loadSingleUserContent(
  contentType: ContentType,
  slug: string,
  handle: string,
  options: SingleContentOptions = {}
): LoadedContent | null {
  // TIN-1952/TIN-1931: resolve the slug against the SAME bundled+live overlay
  // the listing loaders use, so a post visible in /blog is loadable by slug.
  // Reusing loadFromUserDirectory means live (contentDir) wins when both dirs
  // define the slug, and bundledContentDir is the fallback when the live PVC is
  // empty. Previously this read only the live dir, so bundled-only posts 404ed
  // on the detail page while still rendering in the listing.
  const extensions = ['.md', '.mdx'];
  const overlaid = loadFromUserDirectory(handle, contentType, extensions);
  const found = overlaid.find((item) => item.slug === slug) ?? null;
  if (!found) {
    return null;
  }

  // Fail closed: the overlay now resolves bundled-only posts, so a draft/private
  // bundled post must not become reachable by slug just because it exists in the
  // baseline. Apply the same visibility/published gate the public listing uses;
  // auth-gated raw consumers pass includeUnpublished to bypass it.
  return passesBySlugGate(found.metadata as Record<string, unknown>, options)
    ? found
    : null;
}




export function findContentBySlug(
  contentType: ContentType,
  slug: string,
  options: SingleContentOptions = {}
): LoadedContent | null {
  // TIN-1952/TIN-1931: enumerate handles from BOTH the bundled baseline and the
  // live content root (union), mirroring loadFromAllUserDirectories. When the
  // live PVC is empty the live users dir may not exist at all, so the previous
  // live-only enumeration returned null for every bundled-only author — the
  // root cause of /blog/[slug] 404s while /blog listed the same posts.
  //
  // The by-slug gate lives in loadSingleUserContent (the shared single-item
  // resolver), so every exported by-slug API that routes through it — this
  // finder, loadBlogPost/loadBlogPostSync, and getUserContentFilePath — inherits
  // the fail-closed default and the includeUnpublished opt-out uniformly.
  for (const handle of getOverlaidUserHandles()) {
    const content = loadSingleUserContent(contentType, slug, handle, options);
    if (content) {
      return content;
    }
  }

  return null;
}




export function getUsersWithContent(contentType: ContentType): string[] {
  const handles: string[] = [];
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return handles;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const contentDir = getUserContentDir(handle, contentType);
    if (existsSync(contentDir)) {
      const files = readdirSync(contentDir).filter(
        (f) => f.endsWith('.md') || f.endsWith('.mdx')
      );
      if (files.length > 0) {
        handles.push(handle);
      }
    }
  }

  return handles;
}




export function userHasContent(
  handle: string,
  contentType: ContentType
): boolean {
  const contentDir = getUserContentDir(handle, contentType);
  if (!existsSync(contentDir)) {
    return false;
  }
  const files = readdirSync(contentDir).filter(
    (f) => f.endsWith('.md') || f.endsWith('.mdx')
  );
  return files.length > 0;
}




export function extractAuthorHandle(
  metadata: Record<string, unknown>
): string {
  if (
    typeof metadata.author === 'object' &&
    (metadata.author as Record<string, unknown>)?.handle
  ) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  if (
    typeof metadata.organizer === 'object' &&
    (metadata.organizer as Record<string, unknown>)?.handle
  ) {
    return (metadata.organizer as Record<string, unknown>).handle as string;
  }
  if (typeof metadata.organizer === 'string' && metadata.organizer) {
    return metadata.organizer;
  }

  if (
    typeof metadata.coordinator === 'object' &&
    (metadata.coordinator as Record<string, unknown>)?.handle
  ) {
    return (metadata.coordinator as Record<string, unknown>).handle as string;
  }
  if (typeof metadata.coordinator === 'string' && metadata.coordinator) {
    return metadata.coordinator;
  }

  return (metadata.handle as string) || 'unknown';
}





const CONTENT_TYPE_DIR_MAP: Record<string, ContentType> = {
  blog: 'blog',
  note: 'notes',
  notes: 'notes',
  event: 'events',
  events: 'events',
  program: 'programs',
  programs: 'programs',
  product: 'products',
  products: 'products',
  video: 'videos',
  videos: 'videos',
  gallery: 'gallery',
  profile: 'blog', 
  stacks: 'stacks',
};




export function getUserContentFilePath(
  contentType: string,
  slug: string,
  options: SingleContentOptions = {}
): string | null {
  const normalizedType = CONTENT_TYPE_DIR_MAP[contentType];
  if (!normalizedType) {
    return null;
  }

  // Inherits the by-slug gate via findContentBySlug: a draft/private post's
  // path resolves only for raw consumers (e.g. scheduling a not-yet-published
  // post) that pass includeUnpublished; public callers get null for hidden slugs.
  const content = findContentBySlug(normalizedType, slug, options);
  if (content) {
    return content.filePath;
  }

  return null;
}




export function getUserContentFilePathByHandle(
  handle: string,
  contentType: string,
  slug: string,
  extension: string = '.md'
): string {
  const normalizedType =
    CONTENT_TYPE_DIR_MAP[contentType] || (contentType as ContentType);

  if (contentType === 'profile') {
    return getUserProfilePath(handle);
  }

  return join(
    getUserContentDir(handle, normalizedType),
    `${slug}${extension}`
  );
}




export function findUserContentFilePath(
  handle: string,
  contentType: string,
  slug: string
): string | null {
  const normalizedType =
    CONTENT_TYPE_DIR_MAP[contentType] || (contentType as ContentType);
  const extensions = ['.md', '.mdx'];

  if (contentType === 'profile') {
    const profilePath = getUserProfilePath(handle);
    return existsSync(profilePath) ? profilePath : null;
  }

  const baseDir = getUserContentDir(handle, normalizedType);

  for (const ext of extensions) {
    const filePath = join(baseDir, `${slug}${ext}`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}







function loadFilesFromDir(
  dir: string,
  handle: string,
  extensions: string[],
  bySlug: Map<string, LoadedContent>
): void {
  if (!existsSync(dir)) {
    return;
  }

  const files = readdirSync(dir).filter((f) =>
    extensions.some((ext) => f.endsWith(ext))
  );

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const { data: metadata, content } = matter(fileContent);
      const slug = file.replace(/\.(md|mdx)$/, '');

      // Key by slug (basename sans extension), NOT the full filename, so live
      // shadows bundled ACROSS extensions: a live `foo.mdx` must override a
      // bundled `foo.md` of the same slug. Keying by filename left both in the
      // map (distinct keys), leaking the stale bundled copy into the listing and
      // letting the by-slug .find() return whichever came first (bundled).
      bySlug.set(slug, {
        slug,
        metadata,
        content,
        filePath,
        ownerHandle: handle,
      });
    } catch (error) {
      console.error(
        `[UserContentLoader] Failed to load ${filePath}:`,
        error
      );
    }
  }
}

function loadFromUserDirectory(
  handle: string,
  contentType: ContentType,
  extensions: string[]
): LoadedContent[] {
  const liveDir = getUserContentDir(handle, contentType);
  const bundledUsersDir = getBundledUsersDir();
  const bundledDir = bundledUsersDir
    ? join(bundledUsersDir, handle, contentType)
    : undefined;

  // Bundled first, then live — live entries overwrite bundled ones per slug.
  const bySlug = new Map<string, LoadedContent>();
  if (bundledDir) {
    loadFilesFromDir(bundledDir, handle, extensions, bySlug);
  }
  loadFilesFromDir(liveDir, handle, extensions, bySlug);

  return Array.from(bySlug.values());
}

/**
 * Enumerate every user handle that owns a directory in either the bundled
 * baseline or the live content root (union, bundled first). Shared by the
 * aggregate listing loader and the single-slug finder so both see the same
 * handle set — critical when the live users dir is an empty/absent PVC
 * (TIN-1952) and an author exists only under bundledContentDir.
 */
function getOverlaidUserHandles(): string[] {
  const liveUsersDir = getUsersDir();
  const bundledUsersDir = getBundledUsersDir();

  const handles = new Set<string>();
  for (const dir of [bundledUsersDir, liveUsersDir]) {
    if (!dir || !existsSync(dir)) {
      continue;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        handles.add(entry.name);
      }
    }
  }

  return Array.from(handles);
}

function loadFromAllUserDirectories(
  contentType: ContentType,
  extensions: string[]
): LoadedContent[] {
  const results: LoadedContent[] = [];
  for (const handle of getOverlaidUserHandles()) {
    const userContent = loadFromUserDirectory(handle, contentType, extensions);
    results.push(...userContent);
  }

  return results;
}
