import type { Platform } from './types.js';







// Match the registrable host exactly or as a dot-separated subdomain, so a
// lookalike such as youtube.com.example.net or notvimeo.com is not treated
// as YouTube or Vimeo (CodeQL js/incomplete-url-substring-sanitization).
function isHostOrSubdomain(hostname: string, domain: string): boolean {
	return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectPlatform(url: string): Platform | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();

		if (isHostOrSubdomain(hostname, 'youtube.com') || isHostOrSubdomain(hostname, 'youtu.be')) {
			return 'youtube';
		}
		if (isHostOrSubdomain(hostname, 'vimeo.com')) {
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
