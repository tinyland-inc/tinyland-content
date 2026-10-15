import type { CacheEntry, ThumbnailResult } from './types.js';
import { detectPlatform } from './platforms.js';
import { fetchYouTubeThumbnail, fetchPeerTubeThumbnail, fetchVimeoThumbnail } from './fetchers.js';


export const CACHE_TTL = 1000 * 60 * 60 * 24;


const thumbnailCache = new Map<string, CacheEntry>();













export async function getVideoThumbnail(videoUrl: string): Promise<ThumbnailResult | null> {
	const cached = thumbnailCache.get(videoUrl);
	if (cached) {
		const age = Date.now() - cached.timestamp;
		if (age < CACHE_TTL) {
			return { ...cached.result, cached: true };
		}
		thumbnailCache.delete(videoUrl);
	}

	const platform = detectPlatform(videoUrl);
	if (!platform) return null;

	let result: ThumbnailResult | null = null;

	switch (platform) {
		case 'youtube':
			result = await fetchYouTubeThumbnail(videoUrl);
			break;
		case 'peertube':
			result = await fetchPeerTubeThumbnail(videoUrl);
			break;
		case 'vimeo':
			result = await fetchVimeoThumbnail(videoUrl);
			break;
	}

	if (result) {
		thumbnailCache.set(videoUrl, { result, timestamp: Date.now() });
	}

	return result;
}


export function clearThumbnailCache(): void {
	thumbnailCache.clear();
}


export function getCacheStats(): { size: number; keys: string[] } {
	return {
		size: thumbnailCache.size,
		keys: Array.from(thumbnailCache.keys()),
	};
}






export function pruneExpiredCache(): number {
	const now = Date.now();
	let removed = 0;

	for (const [key, entry] of thumbnailCache.entries()) {
		if (now - entry.timestamp >= CACHE_TTL) {
			thumbnailCache.delete(key);
			removed++;
		}
	}

	return removed;
}
