import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getVideoThumbnail,
	clearThumbnailCache,
	getCacheStats,
	pruneExpiredCache,
	CACHE_TTL,
} from '../../src/video-thumbnails/cache.js';

describe('getVideoThumbnail', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clearThumbnailCache();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('returns a thumbnail result for a YouTube URL', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const result = await getVideoThumbnail('https://www.youtube.com/watch?v=abc123');

		expect(result).not.toBeNull();
		expect(result?.platform).toBe('youtube');
		expect(result?.cached).toBe(false);
	});

	it('caches the result after first call', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=cache1');

		const stats = getCacheStats();
		expect(stats.size).toBe(1);
		expect(stats.keys).toContain('https://www.youtube.com/watch?v=cache1');
	});

	it('returns cached result on second call', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const first = await getVideoThumbnail('https://www.youtube.com/watch?v=cached');
		const second = await getVideoThumbnail('https://www.youtube.com/watch?v=cached');

		expect(first?.cached).toBe(false);
		expect(second?.cached).toBe(true);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('cached result has cached: true', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=cf');
		const cached = await getVideoThumbnail('https://www.youtube.com/watch?v=cf');

		expect(cached?.cached).toBe(true);
	});

	it('cached result preserves URL, width, height, platform', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const original = await getVideoThumbnail('https://www.youtube.com/watch?v=preserve');
		const cached = await getVideoThumbnail('https://www.youtube.com/watch?v=preserve');

		expect(cached?.url).toBe(original?.url);
		expect(cached?.width).toBe(original?.width);
		expect(cached?.height).toBe(original?.height);
		expect(cached?.platform).toBe(original?.platform);
	});

	it('refreshes expired cache entries', async () => {
		vi.useFakeTimers();

		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=expire');

		
		vi.advanceTimersByTime(CACHE_TTL + 1);

		const refreshed = await getVideoThumbnail('https://www.youtube.com/watch?v=expire');

		expect(refreshed?.cached).toBe(false);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('does not refetch before TTL expires', async () => {
		vi.useFakeTimers();

		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=noexpire');

		
		vi.advanceTimersByTime(CACHE_TTL - 1);

		const cached = await getVideoThumbnail('https://www.youtube.com/watch?v=noexpire');

		expect(cached?.cached).toBe(true);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('returns null for unknown platforms', async () => {
		const result = await getVideoThumbnail('https://example.com/video');
		expect(result).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('returns null for empty string', async () => {
		const result = await getVideoThumbnail('');
		expect(result).toBeNull();
	});

	it('returns null for invalid URL', async () => {
		const result = await getVideoThumbnail('not-a-url');
		expect(result).toBeNull();
	});

	it('does not cache null results', async () => {
		mockFetch.mockResolvedValue({ ok: false });

		await getVideoThumbnail('https://www.youtube.com/watch?v=fail');
		

		const stats = getCacheStats();
		expect(stats.size).toBe(0);
	});

	it('handles Vimeo URLs', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/thumb.jpg',
				thumbnail_width: 1280,
				thumbnail_height: 720,
			}),
		});

		const result = await getVideoThumbnail('https://vimeo.com/123456');
		expect(result?.platform).toBe('vimeo');
	});

	it('handles PeerTube URLs', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/thumb.jpg' }),
		});

		const result = await getVideoThumbnail('https://pt.example.com/videos/watch/abc-123');
		expect(result?.platform).toBe('peertube');
	});

	it('caches different URLs independently', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=vid1');
		await getVideoThumbnail('https://www.youtube.com/watch?v=vid2');

		const stats = getCacheStats();
		expect(stats.size).toBe(2);
	});

	it('expired entry is removed from cache before refetch', async () => {
		vi.useFakeTimers();

		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=expDel');
		expect(getCacheStats().size).toBe(1);

		vi.advanceTimersByTime(CACHE_TTL + 1);

		
		await getVideoThumbnail('https://www.youtube.com/watch?v=expDel');
		expect(getCacheStats().size).toBe(1);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

describe('clearThumbnailCache', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clearThumbnailCache();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('empties all entries', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=a');
		await getVideoThumbnail('https://www.youtube.com/watch?v=b');
		expect(getCacheStats().size).toBe(2);

		clearThumbnailCache();
		expect(getCacheStats().size).toBe(0);
	});

	it('is safe to call on empty cache', () => {
		expect(() => clearThumbnailCache()).not.toThrow();
		expect(getCacheStats().size).toBe(0);
	});

	it('allows fresh fetches after clearing', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=fresh');
		clearThumbnailCache();

		const result = await getVideoThumbnail('https://www.youtube.com/watch?v=fresh');
		expect(result?.cached).toBe(false);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

describe('getCacheStats', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clearThumbnailCache();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns size 0 and empty keys for empty cache', () => {
		const stats = getCacheStats();
		expect(stats.size).toBe(0);
		expect(stats.keys).toEqual([]);
	});

	it('returns correct size after adding entries', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=s1');
		await getVideoThumbnail('https://www.youtube.com/watch?v=s2');
		await getVideoThumbnail('https://www.youtube.com/watch?v=s3');

		const stats = getCacheStats();
		expect(stats.size).toBe(3);
	});

	it('returns correct keys', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		const urls = [
			'https://www.youtube.com/watch?v=k1',
			'https://www.youtube.com/watch?v=k2',
		];

		for (const url of urls) {
			await getVideoThumbnail(url);
		}

		const stats = getCacheStats();
		expect(stats.keys).toContain(urls[0]);
		expect(stats.keys).toContain(urls[1]);
	});

	it('keys array is a snapshot, not a live reference', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=snap');
		const stats = getCacheStats();

		clearThumbnailCache();

		
		expect(stats.size).toBe(1);
		expect(stats.keys).toHaveLength(1);
	});
});

describe('pruneExpiredCache', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clearThumbnailCache();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('removes expired entries', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=old');

		vi.advanceTimersByTime(CACHE_TTL + 1);

		const removed = pruneExpiredCache();
		expect(removed).toBe(1);
		expect(getCacheStats().size).toBe(0);
	});

	it('returns count of removed entries', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=r1');
		await getVideoThumbnail('https://www.youtube.com/watch?v=r2');
		await getVideoThumbnail('https://www.youtube.com/watch?v=r3');

		vi.advanceTimersByTime(CACHE_TTL + 1);

		const removed = pruneExpiredCache();
		expect(removed).toBe(3);
	});

	it('leaves fresh entries intact', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=fresh1');

		vi.advanceTimersByTime(CACHE_TTL - 1000);

		const removed = pruneExpiredCache();
		expect(removed).toBe(0);
		expect(getCacheStats().size).toBe(1);
	});

	it('removes only expired entries in mixed cache', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		
		await getVideoThumbnail('https://www.youtube.com/watch?v=old1');

		vi.advanceTimersByTime(CACHE_TTL - 500);

		
		await getVideoThumbnail('https://www.youtube.com/watch?v=new1');

		vi.advanceTimersByTime(1000); 

		const removed = pruneExpiredCache();
		expect(removed).toBe(1);
		expect(getCacheStats().size).toBe(1);
		expect(getCacheStats().keys).toContain('https://www.youtube.com/watch?v=new1');
	});

	it('returns 0 when cache is empty', () => {
		const removed = pruneExpiredCache();
		expect(removed).toBe(0);
	});

	it('returns 0 when all entries are fresh', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=f1');
		await getVideoThumbnail('https://www.youtube.com/watch?v=f2');

		const removed = pruneExpiredCache();
		expect(removed).toBe(0);
	});

	it('can be called multiple times safely', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=multi');
		vi.advanceTimersByTime(CACHE_TTL + 1);

		const first = pruneExpiredCache();
		const second = pruneExpiredCache();

		expect(first).toBe(1);
		expect(second).toBe(0);
	});
});

describe('CACHE_TTL', () => {
	it('is 24 hours in milliseconds', () => {
		expect(CACHE_TTL).toBe(1000 * 60 * 60 * 24);
		expect(CACHE_TTL).toBe(86_400_000);
	});
});

describe('integration: full flow', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clearThumbnailCache();
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('detects platform, fetches, caches, and returns cached on second call (YouTube)', async () => {
		mockFetch.mockResolvedValueOnce({ ok: true });

		const first = await getVideoThumbnail('https://www.youtube.com/watch?v=integ1');
		expect(first).not.toBeNull();
		expect(first?.platform).toBe('youtube');
		expect(first?.cached).toBe(false);
		expect(first?.url).toContain('integ1');

		const second = await getVideoThumbnail('https://www.youtube.com/watch?v=integ1');
		expect(second?.cached).toBe(true);
		expect(second?.url).toBe(first?.url);

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('detects platform, fetches, caches, and returns cached on second call (Vimeo)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				thumbnail_url: 'https://i.vimeocdn.com/video/integ.jpg',
				thumbnail_width: 1920,
				thumbnail_height: 1080,
			}),
		});

		const first = await getVideoThumbnail('https://vimeo.com/999');
		expect(first?.platform).toBe('vimeo');
		expect(first?.cached).toBe(false);

		const second = await getVideoThumbnail('https://vimeo.com/999');
		expect(second?.cached).toBe(true);
		expect(second?.url).toBe('https://i.vimeocdn.com/video/integ.jpg');

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('detects platform, fetches, caches, and returns cached on second call (PeerTube)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnailPath: '/static/thumbs/pt.jpg' }),
		});

		const first = await getVideoThumbnail('https://peer.example.org/videos/watch/aaa-bbb');
		expect(first?.platform).toBe('peertube');
		expect(first?.cached).toBe(false);

		const second = await getVideoThumbnail('https://peer.example.org/videos/watch/aaa-bbb');
		expect(second?.cached).toBe(true);

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('handles sequential calls to different platforms', async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true }) 
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/v.jpg' }),
			}); 

		const yt = await getVideoThumbnail('https://www.youtube.com/watch?v=seq1');
		const vim = await getVideoThumbnail('https://vimeo.com/seq2');

		expect(yt?.platform).toBe('youtube');
		expect(vim?.platform).toBe('vimeo');
		expect(getCacheStats().size).toBe(2);
	});

	it('cache survives across different platform calls', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=surv1');

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/v.jpg' }),
		});

		await getVideoThumbnail('https://vimeo.com/surv2');

		
		const cached = await getVideoThumbnail('https://www.youtube.com/watch?v=surv1');
		expect(cached?.cached).toBe(true);
	});

	it('full cycle: fetch, cache, expire, refetch', async () => {
		vi.useFakeTimers();
		mockFetch.mockResolvedValue({ ok: true });

		
		const first = await getVideoThumbnail('https://www.youtube.com/watch?v=cycle');
		expect(first?.cached).toBe(false);

		
		const second = await getVideoThumbnail('https://www.youtube.com/watch?v=cycle');
		expect(second?.cached).toBe(true);

		
		vi.advanceTimersByTime(CACHE_TTL + 1);

		
		const third = await getVideoThumbnail('https://www.youtube.com/watch?v=cycle');
		expect(third?.cached).toBe(false);

		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('pruneExpiredCache then getVideoThumbnail refetches', async () => {
		vi.useFakeTimers();
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=prune');
		vi.advanceTimersByTime(CACHE_TTL + 1);

		pruneExpiredCache();
		expect(getCacheStats().size).toBe(0);

		const result = await getVideoThumbnail('https://www.youtube.com/watch?v=prune');
		expect(result?.cached).toBe(false);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('clearThumbnailCache forces fresh fetch', async () => {
		mockFetch.mockResolvedValue({ ok: true });

		await getVideoThumbnail('https://www.youtube.com/watch?v=clr');
		clearThumbnailCache();

		const result = await getVideoThumbnail('https://www.youtube.com/watch?v=clr');
		expect(result?.cached).toBe(false);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
