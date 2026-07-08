











import { loadUserContent, loadSingleUserContent, findContentBySlug } from './userContentLoader.js';
import type { LoadedBlogPost, BlogListOptions } from '../types.js';
import { migrateVisibility } from '../types.js';























export async function loadBlogPosts(
  options: BlogListOptions = {}
): Promise<LoadedBlogPost[]> {
  const userContent = loadUserContent('blog', {
    handle: options.handle,
    aggregateAll: !options.handle,
  });

  const posts: LoadedBlogPost[] = [];

  for (const item of userContent) {
    const frontmatter = item.metadata as Record<string, unknown>;

    if (!matchesFilters(frontmatter, item.slug, options)) {
      continue;
    }

    posts.push({
      frontmatter,
      content: item.content,
      slug: item.slug,
      filePath: item.filePath,
    });
  }

  
  posts.sort((a, b) => {
    const dateA = new Date(
      (a.frontmatter.publishedAt as string) || (a.frontmatter.date as string) || 0
    );
    const dateB = new Date(
      (b.frontmatter.publishedAt as string) || (b.frontmatter.date as string) || 0
    );
    return dateB.getTime() - dateA.getTime();
  });

  
  const start = options.offset || 0;
  const end = options.limit ? start + options.limit : undefined;

  return posts.slice(start, end);
}




export function loadBlogPostsSync(
  options: BlogListOptions = {}
): LoadedBlogPost[] {
  const userContent = loadUserContent('blog', {
    handle: options.handle,
    aggregateAll: !options.handle,
  });

  const posts: LoadedBlogPost[] = [];

  for (const item of userContent) {
    const frontmatter = item.metadata as Record<string, unknown>;

    if (!matchesFilters(frontmatter, item.slug, options)) {
      continue;
    }

    posts.push({
      frontmatter,
      content: item.content,
      slug: item.slug,
      filePath: item.filePath,
    });
  }

  posts.sort((a, b) => {
    const dateA = new Date(
      (a.frontmatter.publishedAt as string) || (a.frontmatter.date as string) || 0
    );
    const dateB = new Date(
      (b.frontmatter.publishedAt as string) || (b.frontmatter.date as string) || 0
    );
    return dateB.getTime() - dateA.getTime();
  });

  const start = options.offset || 0;
  const end = options.limit ? start + options.limit : undefined;

  return posts.slice(start, end);
}








export async function loadBlogPost(
  slug: string,
  handle?: string
): Promise<LoadedBlogPost | null> {
  let content;
  if (handle) {
    content = loadSingleUserContent('blog', slug, handle);
  } else {
    content = findContentBySlug('blog', slug);
  }

  if (!content) {
    return null;
  }

  return {
    frontmatter: content.metadata as Record<string, unknown>,
    content: content.content,
    slug: content.slug,
    filePath: content.filePath,
  };
}




export function loadBlogPostSync(
  slug: string,
  handle?: string
): LoadedBlogPost | null {
  let content;
  if (handle) {
    content = loadSingleUserContent('blog', slug, handle);
  } else {
    content = findContentBySlug('blog', slug);
  }

  if (!content) {
    return null;
  }

  return {
    frontmatter: content.metadata as Record<string, unknown>,
    content: content.content,
    slug: content.slug,
    filePath: content.filePath,
  };
}




export async function loadSeries(
  seriesName: string
): Promise<LoadedBlogPost[]> {
  const posts = await loadBlogPosts({ series: seriesName });
  return posts.sort(
    (a, b) =>
      ((a.frontmatter.seriesOrder as number) || 0) -
      ((b.frontmatter.seriesOrder as number) || 0)
  );
}




export async function getAllTags(
  options: Pick<BlogListOptions, 'publishedOnly' | 'handle'> = {}
): Promise<string[]> {
  const posts = await loadBlogPosts(options);
  const tags = new Set<string>();

  for (const post of posts) {
    for (const tag of (post.frontmatter.tags as string[]) || []) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort();
}




export async function getAllCategories(
  options: Pick<BlogListOptions, 'publishedOnly' | 'handle'> = {}
): Promise<string[]> {
  const posts = await loadBlogPosts(options);
  const categories = new Set<string>();

  for (const post of posts) {
    for (const category of (post.frontmatter.categories as string[]) || []) {
      categories.add(category);
    }
  }

  return Array.from(categories).sort();
}




export async function getAllSeries(
  options: Pick<BlogListOptions, 'publishedOnly' | 'handle'> = {}
): Promise<string[]> {
  const posts = await loadBlogPosts(options);
  const series = new Set<string>();

  for (const post of posts) {
    if (post.frontmatter.series) {
      series.add(post.frontmatter.series as string);
    }
  }

  return Array.from(series).sort();
}




export async function getRelatedPosts(
  slug: string,
  limit: number = 5
): Promise<LoadedBlogPost[]> {
  const currentPost = await loadBlogPost(slug);
  if (!currentPost) {
    return [];
  }

  const allPosts = await loadBlogPosts({ publishedOnly: true });

  const scored = allPosts
    .filter((p) => p.slug !== slug)
    .map((post) => {
      let score = 0;

      const currentTags = (currentPost.frontmatter.tags as string[]) || [];
      const postTags = (post.frontmatter.tags as string[]) || [];
      const sharedTags = postTags.filter((tag) => currentTags.includes(tag));
      score += sharedTags.length * 2;

      const currentCategories =
        (currentPost.frontmatter.categories as string[]) || [];
      const postCategories =
        (post.frontmatter.categories as string[]) || [];
      const sharedCategories = postCategories.filter((cat) =>
        currentCategories.includes(cat)
      );
      score += sharedCategories.length;

      if (post.frontmatter.series === currentPost.frontmatter.series) {
        score += 10;
      }

      if (post.frontmatter.author === currentPost.frontmatter.author) {
        score += 1;
      }

      return { post, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post }) => post);

  return scored;
}








function matchesFilters(
  frontmatter: Record<string, unknown>,
  slug: string,
  options: BlogListOptions
): boolean {
  if (options.handle && frontmatter.author !== options.handle) {
    return false;
  }

  // Fail closed: unknown/typo values resolve to 'private' (never widen
  // exposure); absent visibility stays 'public'.
  const postVisibility = migrateVisibility(frontmatter.visibility as string | undefined);
  if (options.visibility && !options.visibility.includes(postVisibility)) {
    return false;
  }

  if (options.publishedOnly) {
    const isPublished =
      frontmatter.published !== false && frontmatter.draft !== true;
    if (!isPublished) {
      return false;
    }
  }

  if (options.tags && options.tags.length > 0) {
    const postTags = (frontmatter.tags as string[]) || [];
    const hasMatchingTag = options.tags.some((tag) => postTags.includes(tag));
    if (!hasMatchingTag) {
      return false;
    }
  }

  if (options.categories && options.categories.length > 0) {
    const postCategories = (frontmatter.categories as string[]) || [];
    const hasMatchingCategory = options.categories.some((cat) =>
      postCategories.includes(cat)
    );
    if (!hasMatchingCategory) {
      return false;
    }
  }

  if (options.series && frontmatter.series !== options.series) {
    return false;
  }

  return true;
}




export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}




export function calculateWordCount(content: string): number {
  return content.split(/\s+/).length;
}




export function extractExcerpt(
  content: string,
  maxLength: number = 200
): string {
  const plainText = content
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return truncated.substring(0, lastSpace) + '...';
}
