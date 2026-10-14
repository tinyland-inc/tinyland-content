






































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
  loadOwnedPost,
  updateOwnedPost,
  adoptReviewedOwnedPost,
  deleteOwnedPost,
  loadEventBySlug,
  updatePost,
  updateEvent,
  deletePost,
  deleteEvent,
  extractAuthorHandle,
  extractOrganizerHandle,
  createContentLoader,
} from './services/index.js';
export type { PostOwner, ReviewedOwnedPostAdoption, AdoptedOwnedPost } from './services/index.js';

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
export type { UserContentType, SingleContentOptions } from './loaders/index.js';

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

// --- Event loader (merged from tummycrypt_tinyland_event_loader 0.2.x) ---
// The full original API, including configure/getConfig/resetConfig, is the
// ./event-loader subpath export. The facade keeps its existing aliased names.
export type { EventContent, EventContentFrontmatter, EventLoaderConfig } from './event-loader/index.js';
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
} from './event-loader/index.js';

// --- Product loader (merged from tummycrypt_tinyland_product_loader 0.2.x) ---
// The full original API, including the AuthorReference and LoadedContent types,
// is the ./product-loader subpath export. The facade keeps its existing aliased names.
export type { Product, ProductFrontmatter, ProductLoaderConfig } from './product-loader/index.js';
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
} from './product-loader/index.js';

// --- Profile loader (merged from tummycrypt_tinyland_profile_loader 0.2.x) ---
// The full original API, including configure/getConfig/resetConfig, is the
// ./profile-loader subpath export. The facade keeps its existing aliased names.
export type { Profile, ProfileFrontmatter, ProfileLoaderConfig } from './profile-loader/index.js';
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
} from './profile-loader/index.js';

// --- User resolution (merged from tummycrypt_tinyland_user_resolution 0.2.x) ---
// The full original API, including configure/getConfig/resetConfig and the
// Profile input type, is the ./user-resolution subpath export. The facade keeps
// its existing aliased names.
export type { AdminUser, ResolvedUser, UserResolutionConfig } from './user-resolution/index.js';
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
} from './user-resolution/index.js';

// --- Activity feed (merged from tummycrypt_tinyland_activity_feed 0.2.x) ---
// The full original API, including configure/getConfig/resetConfig, is the
// ./activity-feed subpath export. The facade aliases the config helpers so they
// do not collide with the other merged modules.
export type {
  ActivityItem,
  BlogPostItem,
  ProfileItem,
  ProductItem,
  ActivityFeedConfig,
} from './activity-feed/index.js';
export {
  getRecentActivityServer,
  getActivityByTypeServer,
  getActivityByCategoryServer,
  getActivityByTagServer,
  searchActivityServer,
  configure as configureActivityFeed,
  getConfig as getActivityFeedConfig,
  resetConfig as resetActivityFeedConfig,
} from './activity-feed/index.js';
