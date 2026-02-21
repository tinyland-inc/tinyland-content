/**
 * Content Loader Service
 *
 * Loads file-based content (blog posts, notes, products, events, programs, videos, profiles)
 * from markdown files in per-user directories.
 *
 * All content is loaded from per-user directories:
 * {contentDir}/users/{handle}/{contentType}/
 *
 * @module services/ContentLoaderService
 */

import { join } from 'path';
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig, getLogger, withSpan } from '../config.js';
import type {
  ContentItem,
  LoadContentOptions,
  ContentVisibility,
} from '../types.js';
import { migrateVisibility } from '../types.js';

// ============================================================================
// Directory Helpers
// ============================================================================

/**
 * Get the users directory path from config
 */
function getUsersDir(): string {
  const config = getContentConfig();
  return join(config.contentDir, 'users');
}

/**
 * Get the content directory for a specific user and content type
 */
function getUserContentDir(handle: string, contentType: string): string {
  return join(getUsersDir(), handle, contentType);
}

/**
 * Get all registered user handles (users with directories)
 */
function getAllUserHandles(): string[] {
  const usersDir = getUsersDir();
  if (!existsSync(usersDir)) {
    return [];
  }

  return readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// ============================================================================
// Visibility Helpers
// ============================================================================

/**
 * Check if content should be included based on visibility
 */
function shouldIncludeByVisibility(
  visibility: string,
  options: LoadContentOptions
): boolean {
  if (visibility === 'public') {
    return true;
  }

  if (visibility === 'unlisted' && options.includeUnlisted) {
    return true;
  }

  if (visibility === 'private' && options.includePrivate) {
    return true;
  }

  return false;
}

/**
 * Check if content should be included based on fediverse visibility
 */
function shouldIncludeByFediverseVisibility(
  metadata: Record<string, unknown>,
  options: LoadContentOptions
): boolean {
  if (!options.fediverseVisibility && !options.federatedOnly) {
    return true;
  }

  const fediverseVisibility =
    (metadata.fediverseVisibility as string) || (metadata.visibility as string) || 'public';

  if (options.federatedOnly) {
    if (fediverseVisibility === 'private' || fediverseVisibility === 'direct') {
      return false;
    }
  }

  if (options.fediverseVisibility && options.fediverseVisibility.length > 0) {
    return options.fediverseVisibility.includes(fediverseVisibility as ContentVisibility);
  }

  return true;
}

/**
 * Normalize profile visibility from various formats
 */
function normalizeProfileVisibility(
  visibility: string | undefined,
  published: boolean | undefined
): ContentVisibility {
  if (visibility) {
    return migrateVisibility(visibility);
  }

  if (published === false) return 'private';

  return 'public';
}

/**
 * Extract date from slug or ID for pagination
 */
function extractDateFromSlug(slug: string): number {
  const parsed = Date.parse(slug);
  if (!isNaN(parsed)) {
    return parsed;
  }

  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return new Date(dateMatch[1]).getTime();
  }

  return Date.now();
}

// ============================================================================
// Generic Content Loader
// ============================================================================

/**
 * Load content items of a specific type from user directories
 */
function loadContentType(
  contentType: string,
  dirName: string,
  options: LoadContentOptions,
  publishedAtField: string = 'publishedAt',
  fallbackDateField: string = 'date',
  includeFediverse: boolean = false
): ContentItem[] {
  const logger = getLogger();
  const items: ContentItem[] = [];
  const handles = options.handle ? [options.handle] : getAllUserHandles();

  for (const handle of handles) {
    const dir = getUserContentDir(handle, dirName);

    if (!existsSync(dir)) {
      continue;
    }

    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
      .sort();

    for (const file of files) {
      try {
        const filePath = join(dir, file);
        const fileContent = readFileSync(filePath, 'utf-8');
        const { data: metadata, content: markdownContent } = matter(fileContent);

        const slug = file.replace(/\.(md|mdx)$/, '');

        const visibility = (metadata.visibility as string) || 'public';
        if (!shouldIncludeByVisibility(visibility, options)) {
          continue;
        }

        if (includeFediverse && !shouldIncludeByFediverseVisibility(metadata, options)) {
          continue;
        }

        const item: ContentItem = {
          type: contentType as ContentItem['type'],
          slug,
          content: markdownContent,
          metadata,
          publishedAt: metadata[publishedAtField] || metadata[fallbackDateField],
          updatedAt: metadata.updatedAt as string | undefined,
          authorHandle: handle,
          visibility: visibility as ContentVisibility,
        };

        if (includeFediverse) {
          item.fediverseVisibility = (metadata.fediverseVisibility as ContentVisibility) || (visibility as ContentVisibility);
          item.fediverseId = metadata.activityPubId as string | undefined;
        }

        items.push(item);
      } catch (error) {
        logger.error(`[ContentLoader] Failed to load ${contentType} ${file}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return items;
}

// ============================================================================
// Content Loading Functions
// ============================================================================

/**
 * Load all content for a user (blog posts, notes, products, events, programs, videos, profiles)
 */
export async function loadUserContent(
  handle: string,
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return withSpan('content_loader.load_user_content', async () => {
    const allContent: ContentItem[] = [];

    const blogPosts = await loadBlogPosts({ ...options, handle });
    allContent.push(...blogPosts);

    const notes = await loadNotes({ ...options, handle });
    allContent.push(...notes);

    const products = await loadProducts({ ...options, handle });
    allContent.push(...products);

    const events = await loadEvents({ ...options, handle });
    allContent.push(...events);

    const programs = await loadPrograms({ ...options, handle });
    allContent.push(...programs);

    const videos = await loadVideos({ ...options, handle });
    allContent.push(...videos);

    const profiles = await loadProfiles({ ...options, handle });
    allContent.push(...profiles);

    // Sort by publishedAt (newest first)
    allContent.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Apply pagination
    let filtered = allContent;

    if (options.minId) {
      const minDate = extractDateFromSlug(options.minId);
      filtered = filtered.filter(
        (item) => new Date(item.publishedAt).getTime() < minDate
      );
    }

    if (options.maxId) {
      const maxDate = extractDateFromSlug(options.maxId);
      filtered = filtered.filter(
        (item) => new Date(item.publishedAt).getTime() > maxDate
      );
    }

    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return filtered.slice(offset, offset + limit);
  });
}

/**
 * Load blog posts from user directories
 */
export async function loadBlogPosts(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('blog-post', 'blog', options, 'publishedAt', 'date');
}

/**
 * Load notes from user directories
 */
export async function loadNotes(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('note', 'notes', options);
}

/**
 * Load products from user directories
 */
export async function loadProducts(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('product', 'products', options);
}

/**
 * Load events from user directories
 */
export async function loadEvents(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('event', 'events', options, 'publishedAt', 'date', true);
}

/**
 * Load programs (recurring events/activities) from user directories
 */
export async function loadPrograms(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('program', 'programs', options, 'publishedAt', 'startDate', true);
}

/**
 * Load videos from user directories
 */
export async function loadVideos(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  return loadContentType('video', 'videos', options, 'publishedAt', 'date', true);
}

/**
 * Load profiles from user directories
 *
 * All profiles are loaded from: {contentDir}/users/{handle}/profile.md
 */
export async function loadProfiles(
  options: LoadContentOptions = {}
): Promise<ContentItem[]> {
  const logger = getLogger();
  const items: ContentItem[] = [];
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return items;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    if (options.handle && handle !== options.handle) {
      continue;
    }

    const profilePath = join(usersDir, handle, 'profile.md');
    if (!existsSync(profilePath)) {
      continue;
    }

    try {
      const fileContent = readFileSync(profilePath, 'utf-8');
      const { data: metadata, content: markdownContent } = matter(fileContent);

      const slug = (metadata.slug as string) || handle;
      const authorHandle = (metadata.handle as string) || handle;

      const visibility = normalizeProfileVisibility(
        metadata.visibility as string | undefined,
        metadata.published as boolean | undefined
      );
      if (!shouldIncludeByVisibility(visibility, options)) {
        continue;
      }

      if (!shouldIncludeByFediverseVisibility(metadata, options)) {
        continue;
      }

      items.push({
        type: 'profile',
        slug,
        content: markdownContent,
        metadata,
        publishedAt:
          (metadata.publishedAt as string) ||
          (metadata.joinedDate as string) ||
          new Date().toISOString(),
        updatedAt: metadata.updatedAt as string | undefined,
        authorHandle,
        visibility,
        fediverseVisibility:
          (metadata.fediverseVisibility as ContentVisibility) || visibility,
        fediverseId: metadata.activityPubId as string | undefined,
      });
    } catch (error) {
      logger.error(`[ContentLoader] Failed to load profile from users/${handle}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return items;
}

// ============================================================================
// Single Content Loading
// ============================================================================

/**
 * Find content file path by searching through user directories
 */
function findContentPath(
  contentType: string,
  slug: string
): { filePath: string; handle: string } | null {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return null;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const dir = join(usersDir, handle, contentType);
    if (!existsSync(dir)) continue;

    for (const ext of ['.md', '.mdx']) {
      const filePath = join(dir, `${slug}${ext}`);
      if (existsSync(filePath)) {
        return { filePath, handle };
      }
    }
  }

  return null;
}

/**
 * Load a single blog post by slug (searches all user directories)
 */
export async function loadPostBySlug(slug: string): Promise<ContentItem | null> {
  const found = findContentPath('blog', slug);

  if (!found) {
    return null;
  }

  try {
    const fileContent = readFileSync(found.filePath, 'utf-8');
    const { data: metadata, content: markdownContent } = matter(fileContent);

    return {
      type: 'blog-post',
      slug,
      content: markdownContent,
      metadata,
      publishedAt: (metadata.publishedAt as string) || (metadata.date as string),
      updatedAt: metadata.updatedAt as string | undefined,
      authorHandle: found.handle,
      visibility: ((metadata.visibility as string) || 'public') as ContentVisibility,
    };
  } catch (error) {
    getLogger().error(`[ContentLoader] Failed to load blog post ${slug}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Load a single event by slug (searches all user directories)
 */
export async function loadEventBySlug(slug: string): Promise<ContentItem | null> {
  const found = findContentPath('events', slug);

  if (!found) {
    return null;
  }

  try {
    const fileContent = readFileSync(found.filePath, 'utf-8');
    const { data: metadata, content: markdownContent } = matter(fileContent);

    return {
      type: 'event',
      slug,
      content: markdownContent,
      metadata,
      publishedAt:
        (metadata.publishedAt as string) ||
        (metadata.date as string) ||
        (metadata.startDateTime as string),
      updatedAt: metadata.updatedAt as string | undefined,
      authorHandle: found.handle,
      visibility: ((metadata.visibility as string) || 'public') as ContentVisibility,
      fediverseVisibility: (metadata.fediverseVisibility as ContentVisibility) || (metadata.visibility as ContentVisibility),
      fediverseId: metadata.activityPubId as string | undefined,
    };
  } catch (error) {
    getLogger().error(`[ContentLoader] Failed to load event ${slug}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Content Modification (Update/Delete)
// ============================================================================

/**
 * Update a blog post (searches all user directories)
 */
export async function updatePost(
  slug: string,
  data: Partial<Record<string, unknown>>,
  content?: string
): Promise<void> {
  const found = findContentPath('blog', slug);

  if (!found) {
    throw new Error(`Post not found: ${slug}`);
  }

  const fileContent = readFileSync(found.filePath, 'utf-8');
  const { data: existingFrontmatter, content: existingContent } = matter(fileContent);

  const updatedFrontmatter = {
    ...existingFrontmatter,
    ...data,
    updatedAt: new Date().toISOString(),
    author: existingFrontmatter.author,
    authorId: existingFrontmatter.authorId,
  };

  const updatedContent = content !== undefined ? content : existingContent;
  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);
  writeFileSync(found.filePath, updatedFile, 'utf-8');
}

/**
 * Update an event (searches all user directories)
 */
export async function updateEvent(
  slug: string,
  data: Partial<Record<string, unknown>>,
  content?: string
): Promise<void> {
  const found = findContentPath('events', slug);

  if (!found) {
    throw new Error(`Event not found: ${slug}`);
  }

  const fileContent = readFileSync(found.filePath, 'utf-8');
  const { data: existingFrontmatter, content: existingContent } = matter(fileContent);

  const updatedFrontmatter = {
    ...existingFrontmatter,
    ...data,
    updatedAt: new Date().toISOString(),
    organizer: existingFrontmatter.organizer,
    authorId: existingFrontmatter.authorId,
  };

  const updatedContent = content !== undefined ? content : existingContent;
  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);
  writeFileSync(found.filePath, updatedFile, 'utf-8');
}

/**
 * Delete a blog post (searches all user directories)
 */
export async function deletePost(slug: string): Promise<void> {
  const found = findContentPath('blog', slug);

  if (!found) {
    throw new Error(`Post not found: ${slug}`);
  }

  unlinkSync(found.filePath);
}

/**
 * Delete an event (searches all user directories)
 */
export async function deleteEvent(slug: string): Promise<void> {
  const found = findContentPath('events', slug);

  if (!found) {
    throw new Error(`Event not found: ${slug}`);
  }

  unlinkSync(found.filePath);
}

// ============================================================================
// Helper Extractors
// ============================================================================

/**
 * Extract author handle from metadata.
 * Supports both object format (AuthorReference) and legacy string format.
 *
 * @param metadata - Content frontmatter metadata
 * @returns The author handle string
 *
 * @deprecated String format for author field is deprecated.
 * Use AuthorReference object format with name, handle, and optional avatar.
 */
export function extractAuthorHandle(metadata: Record<string, unknown>): string {
  if (typeof metadata.author === 'object' && (metadata.author as Record<string, unknown>)?.handle) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  return (metadata.handle as string) || 'unknown';
}

/**
 * Extract organizer handle from event metadata.
 * Supports both object format (AuthorReference) and legacy string format.
 * Falls back to author field if organizer is not set.
 *
 * @param metadata - Event frontmatter metadata
 * @returns The organizer/author handle string
 *
 * @deprecated String format for organizer field is deprecated.
 * Use AuthorReference object format with name, handle, and optional avatar.
 */
export function extractOrganizerHandle(metadata: Record<string, unknown>): string {
  if (typeof metadata.author === 'object' && (metadata.author as Record<string, unknown>)?.handle) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.organizer === 'object' && (metadata.organizer as Record<string, unknown>)?.handle) {
    return (metadata.organizer as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.organizer === 'string' && metadata.organizer) {
    return metadata.organizer;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  return (metadata.handle as string) || 'unknown';
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a content loader instance with the current config.
 * This is the preferred way to use the content loader in application code.
 *
 * @example
 * ```typescript
 * const loader = createContentLoader();
 * const posts = await loader.loadBlogPosts({ handle: 'jsullivan' });
 * ```
 */
export function createContentLoader() {
  return {
    loadUserContent,
    loadBlogPosts,
    loadNotes,
    loadProducts,
    loadEvents,
    loadPrograms,
    loadVideos,
    loadProfiles,
    loadPostBySlug,
    loadEventBySlug,
    updatePost,
    updateEvent,
    deletePost,
    deleteEvent,
    extractAuthorHandle,
    extractOrganizerHandle,
  };
}
