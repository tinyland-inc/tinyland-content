/**
 * Shared types for the content package.
 *
 * These types are defined locally to avoid hard coupling to the monorepo's
 * type system. The `@tinyland-inc/tinyland-content-types` workspace dependency
 * provides the canonical content type definitions; these are supplementary
 * types specific to content loading and management operations.
 *
 * @module types
 */

// ============================================================================
// Content Visibility
// ============================================================================

/**
 * Content visibility options (ActivityPub-compatible)
 */
export type ContentVisibility = 'public' | 'unlisted' | 'followers' | 'private' | 'direct';

/**
 * Visibility values as const array
 */
export const CONTENT_VISIBILITY_VALUES = ['public', 'unlisted', 'followers', 'private', 'direct'] as const;

/**
 * Migrate legacy RBAC visibility to ContentVisibility
 *
 * Migration mapping:
 * - 'public' -> 'public'
 * - 'published' -> 'public'
 * - 'members' -> 'followers'
 * - 'admin' -> 'private'
 * - 'private' -> 'private'
 * - 'draft' -> 'private'
 * - 'direct' -> 'direct'
 */
export function migrateVisibility(legacy: string | undefined): ContentVisibility {
  if (!legacy) return 'public';

  const normalized = legacy.toLowerCase();

  switch (normalized) {
    case 'public':
    case 'published':
      return 'public';
    case 'unlisted':
      return 'unlisted';
    case 'members':
    case 'followers':
      return 'followers';
    case 'admin':
    case 'private':
    case 'draft':
      return 'private';
    case 'direct':
      return 'direct';
    default:
      return 'public';
  }
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * All supported content types
 */
export type ContentType =
  | 'blog'
  | 'note'
  | 'product'
  | 'event'
  | 'program'
  | 'video'
  | 'profile';

// ============================================================================
// Content Item
// ============================================================================

/**
 * A loaded content item with metadata from frontmatter
 */
export interface ContentItem {
  type: ContentType | 'blog-post';
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  publishedAt: string;
  updatedAt?: string;
  authorHandle: string;
  visibility: ContentVisibility;
  /** Fediverse visibility for ActivityPub federation */
  fediverseVisibility?: ContentVisibility;
  /** ActivityPub object ID if federated */
  fediverseId?: string;
}

/**
 * Options for loading content
 */
export interface LoadContentOptions {
  handle?: string;
  limit?: number;
  offset?: number;
  minId?: string;
  maxId?: string;
  includeUnlisted?: boolean;
  includePrivate?: boolean;
  /** Filter by fediverse visibility for federation */
  fediverseVisibility?: ContentVisibility[];
  /** Include only content that should be federated */
  federatedOnly?: boolean;
}

// ============================================================================
// Loaded Content (from file system)
// ============================================================================

/**
 * A content item loaded from the filesystem with source tracking
 */
export interface LoadedContent {
  /** Content slug (filename without extension) */
  slug: string;
  /** Parsed frontmatter */
  metadata: Record<string, unknown>;
  /** Markdown content body */
  content: string;
  /** Full file path */
  filePath: string;
  /** Source of the content */
  source?: 'user-directory' | 'legacy-flat';
  /** Owner handle (from directory or metadata) */
  ownerHandle: string;
}

/**
 * Options for dual-source loading
 */
export interface DualSourceOptions {
  /** Filter by user handle */
  handle?: string;
  /** Include content from all users (aggregation mode) */
  aggregateAll?: boolean;
  /** File extensions to include */
  extensions?: string[];
  /** Custom author field extractor */
  extractAuthorHandle?: (metadata: Record<string, unknown>) => string;
}

/**
 * Options for user content loading
 */
export interface LoadOptions {
  /** Filter by user handle */
  handle?: string;
  /** Include content from all users (aggregation mode) */
  aggregateAll?: boolean;
  /** File extensions to include */
  extensions?: string[];
}

// ============================================================================
// Blog Types
// ============================================================================

/**
 * Blog post loading result
 */
export interface LoadedBlogPost {
  frontmatter: Record<string, unknown>;
  content: string;
  slug: string;
  filePath: string;
}

/**
 * Blog list filtering options
 */
export interface BlogListOptions {
  /** Filter by author handle */
  handle?: string;
  /** Filter by visibility levels */
  visibility?: ContentVisibility[];
  /** Limit number of results */
  limit?: number;
  /** Skip N results (for pagination) */
  offset?: number;
  /** Filter by tags (post must have at least one matching tag) */
  tags?: string[];
  /** Filter by series name */
  series?: string;
  /** Filter published posts only */
  publishedOnly?: boolean;
  /** Filter by categories */
  categories?: string[];
}

// ============================================================================
// Video Embed Types
// ============================================================================

/**
 * Video embed metadata
 */
export interface VideoEmbed {
  url: string;
  platform: 'youtube' | 'vimeo' | 'peertube' | 'self-hosted';
  title?: string;
  thumbnailUrl?: string;
  videoId?: string;
}

/**
 * Reference link in content
 */
export interface Reference {
  title: string;
  url: string;
  description?: string;
}

// ============================================================================
// Relationship Types
// ============================================================================

/**
 * Resolved content relationships
 */
export interface ResolvedRelationships {
  relatedProducts: (Record<string, unknown> & { authorHandle: string })[];
  relatedPosts: (Record<string, unknown> & { authorHandle: string })[];
  videos: VideoEmbed[];
  references: Reference[];
}

/**
 * Context for relationship resolution
 */
export interface RelationshipContext {
  currentSlug: string;
  currentType: 'blog' | 'product' | 'note';
  authorHandle: string;
}

// ============================================================================
// Version History Types
// ============================================================================

/**
 * Content version record with full metadata
 */
export interface ContentVersion {
  id: string;
  contentType: string;
  slug: string;
  version: number;
  createdAt: string;
  createdBy: string;
  changeType: 'create' | 'edit' | 'status' | 'restore' | 'auto';
  changeSummary?: string;
  frontmatter: Record<string, unknown>;
  content: string;
  diff?: {
    frontmatterDiff: Record<string, { old: unknown; new: unknown }>;
    contentDiff: string;
  };
}

/**
 * Version index structure (stored in versions.json)
 */
export interface VersionIndex {
  currentVersion: number;
  versions: Array<{
    version: number;
    createdAt: string;
    changeType: ContentVersion['changeType'];
    createdBy: string;
    changeSummary?: string;
  }>;
}

/**
 * Query parameters for version history
 */
export interface VersionQuery {
  contentType: string;
  slug: string;
  limit?: number;
  before?: string;
  after?: string;
}

/**
 * Comparison result between two versions
 */
export interface VersionComparison {
  from: ContentVersion;
  to: ContentVersion;
  frontmatterDiff: Record<string, { old: unknown; new: unknown }>;
  contentDiff: string;
}

// ============================================================================
// Scheduling Types
// ============================================================================

/**
 * A content item scheduled for future publishing
 */
export interface ScheduledItem {
  id: string;
  contentType: ContentType;
  slug: string;
  scheduledAt: string;
  timezone: string;
  autoFederate: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Result of a publish operation
 */
export interface PublishResult {
  success: boolean;
  contentType: ContentType;
  slug: string;
  publishedAt: string;
  federated: boolean;
  federationError?: string;
}

/**
 * Hooks for extending publish behavior (e.g., ActivityPub federation)
 */
export interface PublishHooks {
  /** Called after content is published (e.g., for ActivityPub Create activity) */
  onPublish?: (item: ContentItem) => Promise<void>;
  /** Called after content is unpublished (e.g., for ActivityPub Delete activity) */
  onUnpublish?: (item: ContentItem) => Promise<void>;
}

/**
 * Internal schedule storage format
 */
export interface ScheduleStorage {
  items: ScheduledItem[];
  lastProcessed: string;
}
