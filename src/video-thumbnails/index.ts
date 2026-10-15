
export type { ThumbnailResult, CacheEntry, Platform } from './types.js';


export { detectPlatform, extractYouTubeId } from './platforms.js';


export { fetchYouTubeThumbnail, fetchPeerTubeThumbnail, fetchVimeoThumbnail } from './fetchers.js';


export {
	CACHE_TTL,
	getVideoThumbnail,
	clearThumbnailCache,
	getCacheStats,
	pruneExpiredCache,
} from './cache.js';
