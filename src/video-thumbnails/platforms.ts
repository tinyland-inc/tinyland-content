import type { Platform } from './types.js';







export function detectPlatform(url: string): Platform | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();

		if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
			return 'youtube';
		}
		if (hostname.includes('vimeo.com')) {
			return 'vimeo';
		}
		
		if (url.includes('/videos/watch/') || url.includes('/w/')) {
			return 'peertube';
		}

		return null;
	} catch {
		return null;
	}
}









export function extractYouTubeId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
		/youtube\.com\/v\/([^&?/]+)/,
		/youtube\.com\/shorts\/([^&?/]+)/,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match?.[1]) {
			return match[1];
		}
	}

	return null;
}
