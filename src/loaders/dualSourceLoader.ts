


















import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig } from '../config.js';
import type { LoadedContent, DualSourceOptions } from '../types.js';





export type ContentType =
  | 'blog'
  | 'products'
  | 'events'
  | 'programs'
  | 'notes'
  | 'videos'
  | 'gallery'
  | 'stacks';




const LEGACY_DIR_MAP: Record<ContentType, string> = {
  blog: 'blog',
  products: 'products',
  events: 'events',
  programs: 'programs',
  notes: 'notes',
  videos: 'videos',
  gallery: 'gallery',
  stacks: 'stacks',
};





function getContentBase(): string {
  return getContentConfig().contentDir;
}

function getUsersDir(): string {
  return join(getContentBase(), 'users');
}




export function getUserContentDir(
  handle: string,
  contentType: ContentType
): string {
  return join(getUsersDir(), handle, contentType);
}




export function getLegacyContentDir(contentType: ContentType): string {
  return join(getContentBase(), LEGACY_DIR_MAP[contentType]);
}




export function getUserBaseDir(handle: string): string {
  return join(getUsersDir(), handle);
}




export function userDirectoryExists(handle: string): boolean {
  return existsSync(getUserBaseDir(handle));
}












export function loadDualSource(
  contentType: ContentType,
  options: DualSourceOptions = {}
): LoadedContent[] {
  const {
    handle,
    aggregateAll = false,
    extensions = ['.md', '.mdx'],
    extractAuthorHandle = defaultExtractAuthorHandle,
  } = options;

  const results: LoadedContent[] = [];
  const seenSlugs = new Set<string>();

  
  if (handle) {
    const userContent = loadFromUserDirectory(handle, contentType, extensions);
    for (const item of userContent) {
      if (!seenSlugs.has(item.slug)) {
        seenSlugs.add(item.slug);
        results.push(item);
      }
    }
  } else if (aggregateAll) {
    const allUserContent = loadFromAllUserDirectories(
      contentType,
      extensions
    );
    for (const item of allUserContent) {
      if (!seenSlugs.has(item.slug)) {
        seenSlugs.add(item.slug);
        results.push(item);
      }
    }
  }

  
  const legacyContent = loadFromLegacyDirectory(
    contentType,
    extensions,
    extractAuthorHandle
  );

  for (const item of legacyContent) {
    if (seenSlugs.has(item.slug)) {
      continue;
    }

    if (handle && item.ownerHandle !== handle) {
      continue;
    }

    seenSlugs.add(item.slug);
    results.push(item);
  }

  return results;
}




export function loadSingleDualSource(
  contentType: ContentType,
  slug: string,
  handle?: string
): LoadedContent | null {
  const extensions = ['.md', '.mdx'];

  if (handle) {
    const userDir = getUserContentDir(handle, contentType);
    for (const ext of extensions) {
      const filePath = join(userDir, `${slug}${ext}`);
      const content = loadSingleFile(filePath, 'user-directory', handle);
      if (content) {
        return content;
      }
    }
  }

  const legacyDir = getLegacyContentDir(contentType);
  for (const ext of extensions) {
    const filePath = join(legacyDir, `${slug}${ext}`);
    const content = loadSingleFile(filePath, 'legacy-flat');
    if (content) {
      return content;
    }
  }

  return null;
}




export function getUsersWithContent(contentType: ContentType): string[] {
  const handles: string[] = [];
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return handles;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const contentDir = getUserContentDir(handle, contentType);
    if (existsSync(contentDir)) {
      const files = readdirSync(contentDir).filter(
        (f) => f.endsWith('.md') || f.endsWith('.mdx')
      );
      if (files.length > 0) {
        handles.push(handle);
      }
    }
  }

  return handles;
}




export function userHasContent(
  handle: string,
  contentType: ContentType
): boolean {
  const contentDir = getUserContentDir(handle, contentType);
  if (!existsSync(contentDir)) {
    return false;
  }
  const files = readdirSync(contentDir).filter(
    (f) => f.endsWith('.md') || f.endsWith('.mdx')
  );
  return files.length > 0;
}








export function getContentNeedingMigration(
  contentType: ContentType,
  handle: string
): LoadedContent[] {
  const legacyContent = loadFromLegacyDirectory(
    contentType,
    ['.md', '.mdx'],
    defaultExtractAuthorHandle
  );
  const userContent = loadFromUserDirectory(handle, contentType, [
    '.md',
    '.mdx',
  ]);

  const userSlugs = new Set(userContent.map((c) => c.slug));

  return legacyContent.filter(
    (item) => item.ownerHandle === handle && !userSlugs.has(item.slug)
  );
}




export function getLegacyContentOwners(contentType: ContentType): string[] {
  const legacyContent = loadFromLegacyDirectory(
    contentType,
    ['.md', '.mdx'],
    defaultExtractAuthorHandle
  );
  const handles = new Set(legacyContent.map((c) => c.ownerHandle));
  return Array.from(handles).filter((h) => h !== 'unknown');
}





function loadFromUserDirectory(
  handle: string,
  contentType: ContentType,
  extensions: string[]
): LoadedContent[] {
  const dir = getUserContentDir(handle, contentType);

  if (!existsSync(dir)) {
    return [];
  }

  const results: LoadedContent[] = [];
  const files = readdirSync(dir).filter((f) =>
    extensions.some((ext) => f.endsWith(ext))
  );

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const { data: metadata, content } = matter(fileContent);
      const slug = file.replace(/\.(md|mdx)$/, '');

      results.push({
        slug,
        metadata,
        content,
        filePath,
        source: 'user-directory',
        ownerHandle: handle,
      });
    } catch (error) {
      console.error(`[DualSourceLoader] Failed to load ${filePath}:`, error);
    }
  }

  return results;
}

function loadFromAllUserDirectories(
  contentType: ContentType,
  extensions: string[]
): LoadedContent[] {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return [];
  }

  const results: LoadedContent[] = [];
  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const userContent = loadFromUserDirectory(handle, contentType, extensions);
    results.push(...userContent);
  }

  return results;
}

function loadFromLegacyDirectory(
  contentType: ContentType,
  extensions: string[],
  extractAuthorHandle: (metadata: Record<string, unknown>) => string
): LoadedContent[] {
  const dir = getLegacyContentDir(contentType);

  if (!existsSync(dir)) {
    return [];
  }

  const results: LoadedContent[] = [];
  const files = readdirSync(dir).filter((f) =>
    extensions.some((ext) => f.endsWith(ext))
  );

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const { data: metadata, content } = matter(fileContent);
      const slug = file.replace(/\.(md|mdx)$/, '');
      const ownerHandle = extractAuthorHandle(metadata);

      results.push({
        slug,
        metadata,
        content,
        filePath,
        source: 'legacy-flat',
        ownerHandle,
      });
    } catch (error) {
      console.error(`[DualSourceLoader] Failed to load ${filePath}:`, error);
    }
  }

  return results;
}

function loadSingleFile(
  filePath: string,
  source: 'user-directory' | 'legacy-flat',
  handle?: string
): LoadedContent | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const { data: metadata, content } = matter(fileContent);
    const slug =
      filePath
        .split('/')
        .pop()
        ?.replace(/\.(md|mdx)$/, '') || '';
    const ownerHandle = handle || defaultExtractAuthorHandle(metadata);

    return {
      slug,
      metadata,
      content,
      filePath,
      source,
      ownerHandle,
    };
  } catch (error) {
    console.error(`[DualSourceLoader] Failed to load ${filePath}:`, error);
    return null;
  }
}




function defaultExtractAuthorHandle(
  metadata: Record<string, unknown>
): string {
  if (
    typeof metadata.author === 'object' &&
    (metadata.author as Record<string, unknown>)?.handle
  ) {
    return (metadata.author as Record<string, unknown>).handle as string;
  }

  if (typeof metadata.author === 'string' && metadata.author) {
    return metadata.author;
  }

  if (
    typeof metadata.organizer === 'object' &&
    (metadata.organizer as Record<string, unknown>)?.handle
  ) {
    return (metadata.organizer as Record<string, unknown>).handle as string;
  }
  if (typeof metadata.organizer === 'string' && metadata.organizer) {
    return metadata.organizer;
  }

  if (
    typeof metadata.coordinator === 'object' &&
    (metadata.coordinator as Record<string, unknown>)?.handle
  ) {
    return (metadata.coordinator as Record<string, unknown>).handle as string;
  }
  if (typeof metadata.coordinator === 'string' && metadata.coordinator) {
    return metadata.coordinator;
  }

  return (metadata.handle as string) || 'unknown';
}
