import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as root from '../src/index.js';
import * as videoThumbnails from '../src/video-thumbnails/index.js';

// tummycrypt_tinyland_video_thumbnails was merged into this module. The
// ./video-thumbnails subpath keeps its exact runtime API. The root facade does
// not re-export it: the root already exports a different extractYouTubeId
// (from ContentRelationshipService) and getVideoThumbnailUrl, a synchronous
// URL builder with no network or cache.
describe('video thumbnails merge', () => {
  afterEach(() => {
    videoThumbnails.clearThumbnailCache();
    vi.unstubAllGlobals();
  });

  it('keeps the original runtime API on the ./video-thumbnails subpath', () => {
    expect(Object.keys(videoThumbnails).sort()).toEqual([
      'CACHE_TTL',
      'clearThumbnailCache',
      'detectPlatform',
      'extractYouTubeId',
      'fetchPeerTubeThumbnail',
      'fetchVimeoThumbnail',
      'fetchYouTubeThumbnail',
      'getCacheStats',
      'getVideoThumbnail',
      'pruneExpiredCache',
    ]);
    expect(videoThumbnails.CACHE_TTL).toBe(1000 * 60 * 60 * 24);
  });

  it('declares the ./video-thumbnails export in package.json', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    expect(manifest.exports['./video-thumbnails']).toEqual({
      types: './dist/video-thumbnails/index.d.ts',
      import: './dist/video-thumbnails/index.js',
    });
  });

  it('leaves the root facade names untouched', () => {
    expect(root.extractYouTubeId).not.toBe(videoThumbnails.extractYouTubeId);
    expect('getVideoThumbnail' in root).toBe(false);
    expect('detectPlatform' in root).toBe(false);
    expect('CACHE_TTL' in root).toBe(false);
  });

  it('resolves and caches a YouTube thumbnail through the subpath', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const first = await videoThumbnails.getVideoThumbnail(url);
    expect(first).toEqual({
      url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      width: 1280,
      height: 720,
      platform: 'youtube',
      cached: false,
    });
    const second = await videoThumbnails.getVideoThumbnail(url);
    expect(second?.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(videoThumbnails.getCacheStats()).toEqual({ size: 1, keys: [url] });
  });
});
