import { describe, it, expect } from 'vitest';
import { detectPlatform, extractYouTubeId } from '../../src/video-thumbnails/platforms.js';

describe('detectPlatform', () => {
	describe('YouTube detection', () => {
		it('detects youtube.com', () => {
			expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
		});

		it('detects youtube.com without www', () => {
			expect(detectPlatform('https://youtube.com/watch?v=abc123')).toBe('youtube');
		});

		it('detects youtu.be short links', () => {
			expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
		});

		it('detects youtube.com/embed', () => {
			expect(detectPlatform('https://youtube.com/embed/abc123')).toBe('youtube');
		});

		it('detects youtube.com/v/', () => {
			expect(detectPlatform('https://youtube.com/v/abc123')).toBe('youtube');
		});

		it('detects youtube.com/shorts/', () => {
			expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube');
		});

		it('is case-insensitive for hostname', () => {
			expect(detectPlatform('https://YOUTUBE.COM/watch?v=abc')).toBe('youtube');
		});
	});

	describe('Vimeo detection', () => {
		it('detects vimeo.com', () => {
			expect(detectPlatform('https://vimeo.com/123456')).toBe('vimeo');
		});

		it('detects vimeo.com with path segments', () => {
			expect(detectPlatform('https://vimeo.com/channels/staffpicks/123456')).toBe('vimeo');
		});

		it('detects player.vimeo.com', () => {
			expect(detectPlatform('https://player.vimeo.com/video/123456')).toBe('vimeo');
		});
	});

	describe('PeerTube detection', () => {
		it('detects /videos/watch/ path', () => {
			expect(detectPlatform('https://peertube.example.com/videos/watch/abc-123')).toBe('peertube');
		});

		it('detects /w/ short path', () => {
			expect(detectPlatform('https://peertube.example.com/w/abc-123')).toBe('peertube');
		});

		it('detects PeerTube on any domain', () => {
			expect(detectPlatform('https://video.mycommunity.org/videos/watch/abc-def')).toBe('peertube');
		});
	});

	describe('unknown and invalid URLs', () => {
		it('returns null for unknown platforms', () => {
			expect(detectPlatform('https://example.com/video')).toBeNull();
		});

		it('returns null for dailymotion', () => {
			expect(detectPlatform('https://www.dailymotion.com/video/x7tgad0')).toBeNull();
		});

		it('returns null for invalid URL', () => {
			expect(detectPlatform('not-a-url')).toBeNull();
		});

		it('returns null for empty string', () => {
			expect(detectPlatform('')).toBeNull();
		});

		it('returns null for protocol-only string', () => {
			expect(detectPlatform('http://')).toBeNull();
		});

		it('returns null for random text', () => {
			expect(detectPlatform('hello world youtube')).toBeNull();
		});
	});
});

describe('extractYouTubeId', () => {
	describe('standard watch URLs', () => {
		it('extracts ID from watch?v= format', () => {
			expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID with extra query params', () => {
			expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID with list param', () => {
			expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123&list=PLxyz')).toBe('abc123');
		});
	});

	describe('short links', () => {
		it('extracts ID from youtu.be short link', () => {
			expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID from youtu.be with params', () => {
			expect(extractYouTubeId('https://youtu.be/abc123?t=10')).toBe('abc123');
		});
	});

	describe('embed URLs', () => {
		it('extracts ID from /embed/ format', () => {
			expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID from /embed/ with params', () => {
			expect(extractYouTubeId('https://www.youtube.com/embed/abc123?autoplay=1')).toBe('abc123');
		});
	});

	describe('/v/ URLs', () => {
		it('extracts ID from /v/ format', () => {
			expect(extractYouTubeId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID from /v/ with params', () => {
			expect(extractYouTubeId('https://www.youtube.com/v/abc123?version=3')).toBe('abc123');
		});
	});

	describe('/shorts/ URLs', () => {
		it('extracts ID from /shorts/ format', () => {
			expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('extracts ID from /shorts/ with params', () => {
			expect(extractYouTubeId('https://www.youtube.com/shorts/abc123?feature=share')).toBe('abc123');
		});
	});

	describe('invalid inputs', () => {
		it('returns null for non-YouTube URL', () => {
			expect(extractYouTubeId('https://vimeo.com/123456')).toBeNull();
		});

		it('returns null for empty string', () => {
			expect(extractYouTubeId('')).toBeNull();
		});

		it('returns null for YouTube channel URL (no video ID)', () => {
			expect(extractYouTubeId('https://www.youtube.com/channel/UCxyz')).toBeNull();
		});

		it('returns null for YouTube homepage', () => {
			expect(extractYouTubeId('https://www.youtube.com/')).toBeNull();
		});

		it('returns null for random text', () => {
			expect(extractYouTubeId('not-a-url')).toBeNull();
		});
	});
});
