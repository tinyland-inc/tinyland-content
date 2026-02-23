





import { describe, it, expect } from 'vitest';
import {
  calculateReadingTime,
  calculateWordCount,
  extractExcerpt,
} from '../src/loaders/blogLoader.js';

describe('blogLoader utilities', () => {
  describe('calculateReadingTime', () => {
    it('should calculate reading time for short content', () => {
      const content = 'Hello world'; 
      expect(calculateReadingTime(content)).toBe(1); 
    });

    it('should calculate reading time for longer content', () => {
      const words = Array(400).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe(2); 
    });

    it('should round up reading time', () => {
      const words = Array(201).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe(2); 
    });
  });

  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      expect(calculateWordCount('Hello world')).toBe(2);
      expect(calculateWordCount('one two three four five')).toBe(5);
    });

    it('should handle single word', () => {
      expect(calculateWordCount('hello')).toBe(1);
    });
  });

  describe('extractExcerpt', () => {
    it('should return full content if shorter than maxLength', () => {
      expect(extractExcerpt('Short content')).toBe('Short content');
    });

    it('should truncate at word boundary', () => {
      const content =
        'This is a test of the excerpt extraction function that should truncate properly at a word boundary.';
      const excerpt = extractExcerpt(content, 50);

      expect(excerpt.length).toBeLessThanOrEqual(53); 
      expect(excerpt.endsWith('...')).toBe(true);
    });

    it('should strip markdown headers', () => {
      const content = '# Header\n\nSome text content here.';
      const excerpt = extractExcerpt(content, 200);
      expect(excerpt).not.toContain('#');
      expect(excerpt).toContain('Header');
    });

    it('should strip markdown links', () => {
      const content = 'Check out [this link](https://example.com) for more.';
      const excerpt = extractExcerpt(content, 200);
      expect(excerpt).not.toContain('[');
      expect(excerpt).not.toContain('(https://');
      expect(excerpt).toContain('this link');
    });

    it('should strip emphasis markers', () => {
      const content = 'This is **bold** and *italic* text.';
      const excerpt = extractExcerpt(content, 200);
      expect(excerpt).not.toContain('*');
      expect(excerpt).toContain('bold');
      expect(excerpt).toContain('italic');
    });
  });
});
