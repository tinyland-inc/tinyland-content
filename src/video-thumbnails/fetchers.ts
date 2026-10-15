import type { ThumbnailResult } from './types.js';
import { extractYouTubeId } from './platforms.js';





export async function fetchYouTubeThumbnail(url: string): Promise<ThumbnailResult | null> {
	const videoId = extractYouTubeId(url);
	if (!videoId) return null;

	const thumbnails = [
		{ url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
		{ url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
		{ url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
	];

	for (const thumb of thumbnails) {
		try {
			const res = await fetch(thumb.url, { method: 'HEAD' });
			if (res.ok) {
				return {
					url: thumb.url,
					width: thumb.width,
					height: thumb.height,
					platform: 'youtube',
					cached: false,
				};
			}
		} catch {
			continue;
		}
	}

	return null;
}




export async function fetchPeerTubeThumbnail(url: string): Promise<ThumbnailResult | null> {
	try {
		const urlObj = new URL(url);
		const instance = urlObj.origin;

		const uuidMatch = url.match(/\/(?:videos\/watch|w)\/([a-zA-Z0-9-]+)/);
		if (!uuidMatch?.[1]) return null;

		const uuid = uuidMatch[1];
		const apiUrl = `${instance}/api/v1/videos/${uuid}`;

		const res = await fetch(apiUrl, {
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		const thumbnailPath = (data.thumbnailPath ?? data.previewPath) as string | undefined;
		if (!thumbnailPath) return null;

		return {
			url: `${instance}${thumbnailPath}`,
			width: 560,
			height: 315,
			platform: 'peertube',
			cached: false,
		};
	} catch {
		return null;
	}
}




export async function fetchVimeoThumbnail(url: string): Promise<ThumbnailResult | null> {
	try {
		const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;

		const res = await fetch(oembedUrl, {
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		if (!data.thumbnail_url) return null;

		return {
			url: data.thumbnail_url as string,
			width: (data.thumbnail_width as number) || 640,
			height: (data.thumbnail_height as number) || 360,
			platform: 'vimeo',
			cached: false,
		};
	} catch {
		return null;
	}
}
