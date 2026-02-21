/**
 * @tummycrypt/tinyland-content
 *
 * Content management services for markdown-based content with versioning,
 * scheduling, and relationship resolution.
 *
 * Usage:
 * ```typescript
 * import {
 *   configureContent,
 *   createContentLoader,
 *   createVersionHistory,
 *   createScheduledPublisher,
 *   createContentRelationshipService,
 * } from '@tummycrypt/tinyland-content';
 *
 * // Initialize once at startup
 * configureContent({
 *   contentDir: './src/content',
 *   dataDir: './data',
 *   logger: myStructuredLogger,
 *   tracer: myOtelTracer,
 * });
 *
 * // Use services
 * const loader = createContentLoader();
 * const posts = await loader.loadBlogPosts({ handle: 'jsullivan' });
 *
 * const versionHistory = createVersionHistory();
 * await versionHistory.saveVersion('blog', 'my-post', frontmatter, content, 'edit', 'jsullivan');
 *
 * const scheduler = createScheduledPublisher();
 * await scheduler.initialize();
 * ```
 *
 * @module @tummycrypt/tinyland-content
 */

// Configuration
export {
  configureContent,
  getContentConfig,
  resetContentConfig,
  getLogger,
  getTracer,
  withSpan,
} from './config.js';
export type {
  ContentServiceConfig,
  Logger,
  Tracer,
  Span,
} from './config.js';

// Types
export type {
  ContentVisibility,
  ContentType,
  ContentItem,
  LoadContentOptions,
  LoadedContent,
  DualSourceOptions,
  LoadOptions,
  LoadedBlogPost,
  BlogListOptions,
  VideoEmbed,
  Reference,
  ResolvedRelationships,
  RelationshipContext,
  ContentVersion,
  VersionIndex,
  VersionQuery,
  VersionComparison,
  ScheduledItem,
  PublishResult,
  PublishHooks,
  ScheduleStorage,
} from './types.js';
export {
  migrateVisibility,
  CONTENT_VISIBILITY_VALUES,
} from './types.js';

// Services
export {
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
  createContentLoader,
} from './services/index.js';

export {
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
  createContentRelationshipService,
} from './services/index.js';

export {
  OfferBuilderService,
  TRANSACTION_MAPPINGS,
  createOfferBuilder,
} from './services/index.js';
export type {
  OfferAvailability,
  PaymentMethod,
  PriceSpecification,
  SchemaOffer,
  TransactionConfig,
  TransactionMapping,
  ValidationResult,
  OfferContentItem,
} from './services/index.js';

// Versioning
export {
  VersionHistoryService,
  createVersionHistory,
} from './versioning/index.js';

// Scheduling
export {
  ScheduledPublishingService,
  createScheduledPublisher,
} from './scheduling/index.js';
