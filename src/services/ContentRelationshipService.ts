/**
 * Content Relationship Service
 *
 * Resolves bidirectional relationships between content types.
 * Handles product-to-post and post-to-product cross-references,
 * video thumbnail resolution, and reference extraction.
 *
 * @module services/ContentRelationshipService
 */

import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig, getLogger } from '../config.js';
import type {
  ResolvedRelationships,
  RelationshipContext,
  VideoEmbed,
} from '../types.js';

// ============================================================================
// Directory Helpers
// ============================================================================

function getContentDir(subdir: string): string {
  const config = getContentConfig();
  return join(config.contentDir, subdir);
}

// ============================================================================
// Post Relationship Resolution
// ============================================================================

/**
 * Resolve all relationships for a blog post
 *
 * @param post - Blog post frontmatter with relatedProducts, relatedPosts, videos, references
 * @param context - Relationship context with current slug, type, and author
 * @returns Resolved relationships including loaded related content
 */
export async function resolvePostRelationships(
  post: Record<string, unknown>,
  context: RelationshipContext
): Promise<ResolvedRelationships> {
  const [relatedProducts, relatedPosts] = await Promise.all([
    resolveProductSlugs(
      (post.relatedProducts as string[]) || [],
      context.authorHandle
    ),
    resolvePostSlugs(
      (post.relatedPosts as string[]) || [],
      context.authorHandle,
      context.currentSlug
    ),
  ]);

  // Resolve video thumbnails automatically
  const videosWithThumbnails = ((post.videos as VideoEmbed[]) || []).map(
    (video) => ({
      ...video,
      thumbnailUrl: video.thumbnailUrl || getVideoThumbnailUrl(video),
      videoId: extractVideoId(video),
    })
  );

  return {
    relatedProducts,
    relatedPosts,
    videos: videosWithThumbnails,
    references: (post.references as ResolvedRelationships['references']) || [],
  };
}

// ============================================================================
// Slug Resolution
// ============================================================================

/**
 * Resolve product slugs to full frontmatter with authorHandle
 */
export async function resolveProductSlugs(
  slugs: string[],
  authorHandle: string
): Promise<(Record<string, unknown> & { authorHandle: string })[]> {
  if (!slugs.length) return [];

  const logger = getLogger();
  const products: (Record<string, unknown> & { authorHandle: string })[] = [];
  const productsDir = getContentDir('products');

  for (const slug of slugs) {
    const filePath = join(productsDir, `${slug}.md`);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const { data } = matter(content);
        products.push({ ...data, slug, authorHandle });
      } catch (error) {
        logger.error(`[ContentRelationship] Failed to load product ${slug}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return products;
}

/**
 * Resolve post slugs to full frontmatter with authorHandle
 */
export async function resolvePostSlugs(
  slugs: string[],
  authorHandle: string,
  excludeSlug?: string
): Promise<(Record<string, unknown> & { authorHandle: string })[]> {
  if (!slugs.length) return [];

  const logger = getLogger();
  const posts: (Record<string, unknown> & { authorHandle: string })[] = [];
  const blogDir = getContentDir('blog');

  for (const slug of slugs) {
    if (slug === excludeSlug) continue;

    const filePath = join(blogDir, `${slug}.md`);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const { data } = matter(content);
        posts.push({ ...data, slug, authorHandle });
      } catch (error) {
        logger.error(`[ContentRelationship] Failed to load post ${slug}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return posts;
}

// ============================================================================
// Reverse Lookups
// ============================================================================

/**
 * Find posts that reference a product (reverse lookup)
 */
export async function findPostsReferencingProduct(
  productSlug: string,
  authorHandle: string
): Promise<(Record<string, unknown> & { authorHandle: string })[]> {
  const logger = getLogger();
  const blogDir = getContentDir('blog');
  const referencingPosts: (Record<string, unknown> & { authorHandle: string })[] = [];

  if (!existsSync(blogDir)) return [];

  try {
    const files = readdirSync(blogDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = join(blogDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const { data } = matter(content);

      const relatedProducts = (data as Record<string, unknown>).relatedProducts as string[] || [];
      if (relatedProducts.includes(productSlug)) {
        const slug = file.replace('.md', '');
        referencingPosts.push({ ...data, slug, authorHandle });
      }
    }
  } catch (error) {
    logger.error(
      `[ContentRelationship] Failed to find posts for product ${productSlug}:`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }

  // Sort by date (newest first)
  return referencingPosts.sort((a, b) => {
    const dateA = new Date(
      (a.publishedAt as string) || (a.date as string) || 0
    ).getTime();
    const dateB = new Date(
      (b.publishedAt as string) || (b.date as string) || 0
    ).getTime();
    return dateB - dateA;
  });
}

/**
 * Find products referenced by a post
 */
export async function findProductsReferencedByPost(
  postSlug: string,
  authorHandle: string
): Promise<(Record<string, unknown> & { authorHandle: string })[]> {
  const logger = getLogger();
  const blogDir = getContentDir('blog');
  const filePath = join(blogDir, `${postSlug}.md`);

  if (!existsSync(filePath)) return [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    const relatedProducts = (data as Record<string, unknown>).relatedProducts as string[] || [];

    return resolveProductSlugs(relatedProducts, authorHandle);
  } catch (error) {
    logger.error(
      `[ContentRelationship] Failed to find products for post ${postSlug}:`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    return [];
  }
}

// ============================================================================
// Video Helpers
// ============================================================================

/**
 * Extract video ID from a video embed based on platform
 */
export function extractVideoId(video: VideoEmbed): string | undefined {
  switch (video.platform) {
    case 'youtube':
      return extractYouTubeId(video.url) || undefined;
    case 'vimeo':
      return extractVimeoId(video.url) || undefined;
    case 'peertube':
      return extractPeerTubeInfo(video.url)?.videoId;
    default:
      return undefined;
  }
}

/**
 * Get video thumbnail URL with automatic resolution
 */
export function getVideoThumbnailUrl(video: VideoEmbed): string {
  if (video.thumbnailUrl) {
    return video.thumbnailUrl;
  }

  switch (video.platform) {
    case 'youtube': {
      const videoId = extractYouTubeId(video.url);
      return videoId
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        : '';
    }
    case 'vimeo': {
      // Vimeo oEmbed endpoint requires async API call
      return '';
    }
    case 'peertube': {
      const peertubeInfo = extractPeerTubeInfo(video.url);
      if (peertubeInfo) {
        return `https://${peertubeInfo.host}/lazy-static/thumbnails/${peertubeInfo.videoId}.jpg`;
      }
      return '';
    }
    default:
      return '';
  }
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract Vimeo video ID from URL
 */
export function extractVimeoId(url: string): string | null {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract PeerTube instance and video ID from URL
 */
export function extractPeerTubeInfo(
  url: string
): { host: string; videoId: string } | null {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;

    const patterns = [
      /\/videos\/watch\/([a-f0-9-]+)/,
      /\/w\/([a-f0-9-]+)/,
      /\/videos\/embed\/([a-f0-9-]+)/,
    ];

    for (const pattern of patterns) {
      const match = urlObj.pathname.match(pattern);
      if (match) {
        return { host, videoId: match[1] };
      }
    }
  } catch {
    // Invalid URL
  }

  return null;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a content relationship resolver with the current config.
 *
 * @example
 * ```typescript
 * const relationships = createContentRelationshipService();
 * const resolved = await relationships.resolvePostRelationships(post, context);
 * ```
 */
export function createContentRelationshipService() {
  return {
    resolvePostRelationships,
    resolveProductSlugs,
    resolvePostSlugs,
    findPostsReferencingProduct,
    findProductsReferencedByPost,
    extractVideoId,
    getVideoThumbnailUrl,
    extractYouTubeId,
    extractVimeoId,
    extractPeerTubeInfo,
  };
}
