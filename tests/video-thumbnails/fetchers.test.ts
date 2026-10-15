import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYouTubeThumbnail, fetchPeerTubeThumbnail, fetchVimeoThumbnail } from '../../src/video-thumbnails/fetchers.js';

describe('fetchYouTubeThumbnail', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns maxresdefault when available', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');

		expect(result).toEqual({
			url: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
			width: 1280,
			height: 720,
			platform: 'youtube',
			cached: false,
		});
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
			{ method: 'HEAD' },
		);
	});

	it('falls back to hqdefault when maxresdefault fails', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');

		expect(result).toEqual({
			url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
			width: 480,
			height: 360,
			platform: 'youtube',
			cached: false,
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('falls back to mqdefault when both maxres and hq fail', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');

		expect(result).toEqual({
			url: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
			width: 320,
			height: 180,
			platform: 'youtube',
			cached: false,
		});
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('returns null when all resolutions fail', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: false });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');
		expect(result).toBeNull();
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('returns null for invalid YouTube URL (no video ID)', async () => {
		const result = await fetchYouTubeThumbnail('https://www.youtube.com/');
		expect(result).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('handles fetch throwing an error', async () => {
		mockFetch.mockRejectedValue(new Error('Network error'));

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');
		expect(result).toBeNull();
	});

	it('continues after one fetch throws and next succeeds', async () => {
		mockFetch
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc123');

		expect(result).toEqual({
			url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
			width: 480,
			height: 360,
			platform: 'youtube',
			cached: false,
		});
	});

	it('uses correct video ID from youtu.be short link', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://youtu.be/shortId');

		expect(result?.url).toBe('https://img.youtube.com/vi/shortId/maxresdefault.jpg');
	});

	it('uses correct video ID from /shorts/ URL', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/shorts/shortsId');

		expect(result?.url).toBe('https://img.youtube.com/vi/shortsId/maxresdefault.jpg');
	});

	it('always returns cached: false', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const result = await fetchYouTubeThumbnail('https://www.youtube.com/watch?v=abc');
		expect(result?.cached).toBe(false);
	});
});

describe('fetchPeerTubeThumbnail', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('extracts UUID from /videos/watch/ and calls correct API URL', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/static/thumbnails/abc-123.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://peertube.example.com/videos/watch/abc-123');

		expect(mockFetch).toHaveBeenCalledWith(
			'https://peertube.example.com/api/v1/videos/abc-123',
			{ headers: { Accept: 'application/json' } },
		);
		expect(result).toEqual({
			url: 'https://peertube.example.com/static/thumbnails/abc-123.jpg',
			width: 560,
			height: 315,
			platform: 'peertube',
			cached: false,
		});
	});

	it('extracts UUID from /w/ short path', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/thumb.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://instance.org/w/def-456');

		expect(mockFetch).toHaveBeenCalledWith(
			'https://instance.org/api/v1/videos/def-456',
			{ headers: { Accept: 'application/json' } },
		);
		expect(result?.url).toBe('https://instance.org/thumb.jpg');
	});

	it('returns thumbnail from thumbnailPath', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/static/thumbnails/video.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-1');
		expect(result?.url).toBe('https://pt.example.com/static/thumbnails/video.jpg');
	});

	it('falls back to previewPath when thumbnailPath is missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ previewPath: '/static/previews/video.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-2');
		expect(result?.url).toBe('https://pt.example.com/static/previews/video.jpg');
	});

	it('returns null when API returns neither thumbnailPath nor previewPath', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ name: 'Some Video' }),
		});

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-3');
		expect(result).toBeNull();
	});

	it('returns null when API returns non-ok response', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-4');
		expect(result).toBeNull();
	});

	it('returns null for URL without valid UUID', async () => {
		const result = await fetchPeerTubeThumbnail('https://pt.example.com/about');
		expect(result).toBeNull();
	});

	it('returns null when fetch throws', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-5');
		expect(result).toBeNull();
	});

	it('returns platform as peertube', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/thumb.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-6');
		expect(result?.platform).toBe('peertube');
	});

	it('returns cached: false', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/thumb.jpg' }),
		});

		const result = await fetchPeerTubeThumbnail('https://pt.example.com/videos/watch/uuid-7');
		expect(result?.cached).toBe(false);
	});

	it('returns null for invalid URL', async () => {
		const result = await fetchPeerTubeThumbnail('not-a-url');
		expect(result).toBeNull();
	});
});

describe('fetchVimeoThumbnail', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls oEmbed API with encoded URL', async () => {
		const videoUrl = 'https://vimeo.com/123456';
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
				thumbnail_width: 1280,
				thumbnail_height: 720,
			}),
		});

		await fetchVimeoThumbnail(videoUrl);

		expect(mockFetch).toHaveBeenCalledWith(
			`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`,
			{ headers: { Accept: 'application/json' } },
		);
	});

	it('returns thumbnail with provided dimensions', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
				thumbnail_width: 1280,
				thumbnail_height: 720,
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');

		expect(result).toEqual({
			url: 'https://i.vimeocdn.com/video/thumb.jpg',
			width: 1280,
			height: 720,
			platform: 'vimeo',
			cached: false,
		});
	});

	it('uses default width 640 when thumbnail_width is missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result?.width).toBe(640);
	});

	it('uses default height 360 when thumbnail_height is missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result?.height).toBe(360);
	});

	it('uses default dimensions when both are missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result?.width).toBe(640);
		expect(result?.height).toBe(360);
	});

	it('returns null when thumbnail_url is missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ title: 'Some Video' }),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result).toBeNull();
	});

	it('returns null when API returns non-ok response', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result).toBeNull();
	});

	it('returns null when fetch throws', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result).toBeNull();
	});

	it('returns platform as vimeo', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result?.platform).toBe('vimeo');
	});

	it('returns cached: false', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
			}),
		});

		const result = await fetchVimeoThumbnail('https://vimeo.com/123456');
		expect(result?.cached).toBe(false);
	});
});
