
export type Platform = 'youtube' | 'peertube' | 'vimeo';


export interface ThumbnailResult {
	url: string;
	width: number;
	height: number;
	platform: Platform;
	cached: boolean;
}


export interface CacheEntry {
	result: ThumbnailResult;
	timestamp: number;
}
