





import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureContent, resetContentConfig } from '../src/config.js';
import {
  extractYouTubeId,
  extractVimeoId,
  extractPeerTubeInfo,
  getVideoThumbnailUrl,
  extractVideoId,
} from '../src/services/ContentRelationshipService.js';
import type { VideoEmbed } from '../src/types.js';

describe('ContentRelationshipService', () => {
  beforeEach(() => {
    configureContent({
      contentDir: '/test/content',
      dataDir: '/test/data',
    });
  });

  afterEach(() => {
    resetContentConfig();
  });

  describe('extractYouTubeId', () => {
    it('should extract ID from standard YouTube URL', () => {
      expect(
        extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      ).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from short YouTube URL', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      );
    });

    it('should extract ID from embed URL', () => {
      expect(
        extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')
      ).toBe('dQw4w9WgXcQ');
    });

    it('should return null for non-YouTube URL', () => {
      expect(extractYouTubeId('https://example.com/video')).toBeNull();
    });
  });

  describe('extractVimeoId', () => {
    it('should extract ID from standard Vimeo URL', () => {
      expect(extractVimeoId('https://vimeo.com/123456789')).toBe(
        '123456789'
      );
    });

    it('should extract ID from player URL', () => {
      expect(
        extractVimeoId('https://player.vimeo.com/video/123456789')
      ).toBe('123456789');
    });

    it('should return null for non-Vimeo URL', () => {
      expect(extractVimeoId('https://example.com/video')).toBeNull();
    });
  });

  describe('extractPeerTubeInfo', () => {
    it('should extract info from /videos/watch/ URL', () => {
      const result = extractPeerTubeInfo(
        'https://peertube.example.com/videos/watch/abc123-def456'
      );
      expect(result).toEqual({
        host: 'peertube.example.com',
        videoId: 'abc123-def456',
      });
    });

    it('should extract info from /w/ URL', () => {
      const result = extractPeerTubeInfo(
        'https://tube.example.org/w/abc123-def456'
      );
      expect(result).toEqual({
        host: 'tube.example.org',
        videoId: 'abc123-def456',
      });
    });

    it('should return null for invalid URL', () => {
      expect(extractPeerTubeInfo('not-a-url')).toBeNull();
    });

    it('should return null for URL without video path', () => {
      expect(
        extractPeerTubeInfo('https://example.com/other/path')
      ).toBeNull();
    });
  });

  describe('extractVideoId', () => {
    it('should extract YouTube video ID', () => {
      const video: VideoEmbed = {
        url: 'https://www.youtube.com/watch?v=test123',
        platform: 'youtube',
      };
      expect(extractVideoId(video)).toBe('test123');
    });

    it('should extract Vimeo video ID', () => {
      const video: VideoEmbed = {
        url: 'https://vimeo.com/987654',
        platform: 'vimeo',
      };
      expect(extractVideoId(video)).toBe('987654');
    });

    it('should return undefined for unknown platform', () => {
      const video: VideoEmbed = {
        url: 'https://example.com/video',
        platform: 'self-hosted',
      };
      expect(extractVideoId(video)).toBeUndefined();
    });
  });

  describe('getVideoThumbnailUrl', () => {
    it('should return existing thumbnailUrl if present', () => {
      const video: VideoEmbed = {
        url: 'https://www.youtube.com/watch?v=test123',
        platform: 'youtube',
        thumbnailUrl: 'https://custom.thumb.jpg',
      };
      expect(getVideoThumbnailUrl(video)).toBe('https://custom.thumb.jpg');
    });

    it('should generate YouTube thumbnail URL', () => {
      const video: VideoEmbed = {
        url: 'https://www.youtube.com/watch?v=test123',
        platform: 'youtube',
      };
      expect(getVideoThumbnailUrl(video)).toBe(
        'https://img.youtube.com/vi/test123/maxresdefault.jpg'
      );
    });

    it('should generate PeerTube thumbnail URL', () => {
      const video: VideoEmbed = {
        url: 'https://tube.example.com/w/abc123-def456',
        platform: 'peertube',
      };
      expect(getVideoThumbnailUrl(video)).toBe(
        'https://tube.example.com/lazy-static/thumbnails/abc123-def456.jpg'
      );
    });

    it('should return empty string for Vimeo (requires async API)', () => {
      const video: VideoEmbed = {
        url: 'https://vimeo.com/123456',
        platform: 'vimeo',
      };
      expect(getVideoThumbnailUrl(video)).toBe('');
    });
  });
});
