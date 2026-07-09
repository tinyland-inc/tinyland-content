






































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


export {
  shouldIncludeByVisibility,
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


export {
  VersionHistoryService,
  createVersionHistory,
} from './versioning/index.js';


export {
  ScheduledPublishingService,
  createScheduledPublisher,
} from './scheduling/index.js';


// Loader helpers stay on the facade so callers do not depend on internal package splits.
export {
  loadUserContent as loadUserContentFromLoader,
  loadSingleUserContent,
  findContentBySlug,
  getUsersWithContent,
  userHasContent,
  getUserContentDir,
  getUserBaseDir,
  getUserProfilePath,
  userDirectoryExists,
  getAllUserHandles,
  extractAuthorHandleFromMetadata,
  getUserContentFilePath,
  getUserContentFilePathByHandle,
  findUserContentFilePath,
} from './loaders/index.js';
export type { UserContentType } from './loaders/index.js';

export {
  loadBlogPosts as loadBlogPostsFromLoader,
  loadBlogPost,
  loadSeries,
  getAllTags,
  getAllCategories,
  getAllSeries,
  getRelatedPosts,
} from './loaders/index.js';

export function contentItemToTypedContent<T extends Record<string, unknown>>(item: T): T {
  return item;
}

// --- Event loader re-exports (from tinyland-event-loader) ---
export type { EventContent, EventContentFrontmatter, EventLoaderConfig } from '@tummycrypt/tinyland-event-loader';
export {
  loadEventsServer,
  getUpcomingEventsServer,
  getPastEventsServer,
  getEventBySlugServer,
  getFeaturedEventsServer,
  getRelatedEventsServer,
  getEventsByOrganizerServer,
  configure as configureEventLoader,
  getConfig as getEventLoaderConfig,
  resetConfig as resetEventLoaderConfig,
} from '@tummycrypt/tinyland-event-loader';

// --- Product loader re-exports (from tinyland-product-loader) ---
export type { Product, ProductFrontmatter, ProductLoaderConfig } from '@tummycrypt/tinyland-product-loader';
export {
  loadProductsServer,
  getPublishedProductsServer,
  getFeaturedProductsServer,
  getProductBySlugServer,
  getProductsByCategoryServer,
  getAllCategoriesServer,
  getAllProductTagsServer,
  searchProductsServer,
  getRelatedProductsServer,
  configure as configureProductLoader,
  getConfig as getProductLoaderConfig,
  resetConfig as resetProductLoaderConfig,
} from '@tummycrypt/tinyland-product-loader';

// --- Profile loader re-exports (from tinyland-profile-loader) ---
export type { Profile, ProfileFrontmatter, ProfileLoaderConfig } from '@tummycrypt/tinyland-profile-loader';
export {
  loadProfilesServer,
  getPublishedProfilesServer,
  getFeaturedProfilesServer,
  getProfileBySlugServer,
  getProfilesByRoleServer,
  getProfilesByTagServer,
  getAllRolesServer,
  getAllProfileTagsServer,
  searchProfilesServer,
  getRandomProfilesServer,
  configure as configureProfileLoader,
  getConfig as getProfileLoaderConfig,
  resetConfig as resetProfileLoaderConfig,
} from '@tummycrypt/tinyland-profile-loader';

// --- User resolution re-exports (from tinyland-user-resolution) ---
export type { AdminUser, ResolvedUser, UserResolutionConfig } from '@tummycrypt/tinyland-user-resolution';
export {
  resolveUser,
  userExists,
  getAllUserHandles as getAllUserHandlesFromResolution,
  clearUserResolutionCache,
  RESERVED_ROUTES,
  isReservedRoute,
  configure as configureUserResolution,
  getConfig as getUserResolutionConfig,
  resetConfig as resetUserResolutionConfig,
} from '@tummycrypt/tinyland-user-resolution';
