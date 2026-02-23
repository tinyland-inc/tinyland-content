

















export type ContentVisibility = 'public' | 'unlisted' | 'followers' | 'private' | 'direct';




export const CONTENT_VISIBILITY_VALUES = ['public', 'unlisted', 'followers', 'private', 'direct'] as const;













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








export type ContentType =
  | 'blog'
  | 'note'
  | 'product'
  | 'event'
  | 'program'
  | 'video'
  | 'profile';








export interface ContentItem {
  type: ContentType | 'blog-post';
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  publishedAt: string;
  updatedAt?: string;
  authorHandle: string;
  visibility: ContentVisibility;
  
  fediverseVisibility?: ContentVisibility;
  
  fediverseId?: string;
}




export interface LoadContentOptions {
  handle?: string;
  limit?: number;
  offset?: number;
  minId?: string;
  maxId?: string;
  includeUnlisted?: boolean;
  includePrivate?: boolean;
  
  fediverseVisibility?: ContentVisibility[];
  
  federatedOnly?: boolean;
}








export interface LoadedContent {
  
  slug: string;
  
  metadata: Record<string, unknown>;
  
  content: string;
  
  filePath: string;
  
  source?: 'user-directory' | 'legacy-flat';
  
  ownerHandle: string;
}




export interface DualSourceOptions {
  
  handle?: string;
  
  aggregateAll?: boolean;
  
  extensions?: string[];
  
  extractAuthorHandle?: (metadata: Record<string, unknown>) => string;
}




export interface LoadOptions {
  
  handle?: string;
  
  aggregateAll?: boolean;
  
  extensions?: string[];
}








export interface LoadedBlogPost {
  frontmatter: Record<string, unknown>;
  content: string;
  slug: string;
  filePath: string;
}




export interface BlogListOptions {
  
  handle?: string;
  
  visibility?: ContentVisibility[];
  
  limit?: number;
  
  offset?: number;
  
  tags?: string[];
  
  series?: string;
  
  publishedOnly?: boolean;
  
  categories?: string[];
}








export interface VideoEmbed {
  url: string;
  platform: 'youtube' | 'vimeo' | 'peertube' | 'self-hosted';
  title?: string;
  thumbnailUrl?: string;
  videoId?: string;
}




export interface Reference {
  title: string;
  url: string;
  description?: string;
}








export interface ResolvedRelationships {
  relatedProducts: (Record<string, unknown> & { authorHandle: string })[];
  relatedPosts: (Record<string, unknown> & { authorHandle: string })[];
  videos: VideoEmbed[];
  references: Reference[];
}




export interface RelationshipContext {
  currentSlug: string;
  currentType: 'blog' | 'product' | 'note';
  authorHandle: string;
}








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




export interface VersionQuery {
  contentType: string;
  slug: string;
  limit?: number;
  before?: string;
  after?: string;
}




export interface VersionComparison {
  from: ContentVersion;
  to: ContentVersion;
  frontmatterDiff: Record<string, { old: unknown; new: unknown }>;
  contentDiff: string;
}








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




export interface PublishResult {
  success: boolean;
  contentType: ContentType;
  slug: string;
  publishedAt: string;
  federated: boolean;
  federationError?: string;
}




export interface PublishHooks {
  
  onPublish?: (item: ContentItem) => Promise<void>;
  
  onUnpublish?: (item: ContentItem) => Promise<void>;
}




export interface ScheduleStorage {
  items: ScheduledItem[];
  lastProcessed: string;
}
