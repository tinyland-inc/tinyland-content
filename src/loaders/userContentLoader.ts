










import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import matter from 'gray-matter';
import { getContentConfig } from '../config.js';
import type { LoadedContent, LoadOptions } from '../types.js';





export type ContentType =
  | 'blog'
  | 'products'
  | 'events'
  | 'programs'
  | 'notes'
  | 'videos'
  | 'gallery'
  | 'stacks';





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




export function getUserBaseDir(handle: string): string {
  return join(getUsersDir(), handle);
}




export function getUserProfilePath(handle: string): string {
  return join(getUsersDir(), handle, 'profile.md');
}




export function userDirectoryExists(handle: string): boolean {
  return existsSync(getUserBaseDir(handle));
}




export function getAllUserHandles(): string[] {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return [];
  }

  return readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}


















export function loadUserContent(
  contentType: ContentType,
  options: LoadOptions = {}
): LoadedContent[] {
  const { handle, aggregateAll = false, extensions = ['.md', '.mdx'] } =
    options;

  if (handle) {
    return loadFromUserDirectory(handle, contentType, extensions);
  } else if (aggregateAll) {
    return loadFromAllUserDirectories(contentType, extensions);
  }

  return [];
}




export function loadSingleUserContent(
  contentType: ContentType,
  slug: string,
  handle: string
): LoadedContent | null {
  const extensions = ['.md', '.mdx'];
  const userDir = getUserContentDir(handle, contentType);

  for (const ext of extensions) {
    const filePath = join(userDir, `${slug}${ext}`);
    const content = loadSingleFile(filePath, handle);
    if (content) {
      return content;
    }
  }

  return null;
}




export function findContentBySlug(
  contentType: ContentType,
  slug: string
): LoadedContent | null {
  const usersDir = getUsersDir();

  if (!existsSync(usersDir)) {
    return null;
  }

  const userDirs = readdirSync(usersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const handle of userDirs) {
    const content = loadSingleUserContent(contentType, slug, handle);
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




export function extractAuthorHandle(
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





const CONTENT_TYPE_DIR_MAP: Record<string, ContentType> = {
  blog: 'blog',
  note: 'notes',
  notes: 'notes',
  event: 'events',
  events: 'events',
  program: 'programs',
  programs: 'programs',
  product: 'products',
  products: 'products',
  video: 'videos',
  videos: 'videos',
  gallery: 'gallery',
  profile: 'blog', 
  stacks: 'stacks',
};




export function getUserContentFilePath(
  contentType: string,
  slug: string
): string | null {
  const normalizedType = CONTENT_TYPE_DIR_MAP[contentType];
  if (!normalizedType) {
    return null;
  }

  const content = findContentBySlug(normalizedType, slug);
  if (content) {
    return content.filePath;
  }

  return null;
}




export function getUserContentFilePathByHandle(
  handle: string,
  contentType: string,
  slug: string,
  extension: string = '.md'
): string {
  const normalizedType =
    CONTENT_TYPE_DIR_MAP[contentType] || (contentType as ContentType);

  if (contentType === 'profile') {
    return getUserProfilePath(handle);
  }

  return join(
    getUserContentDir(handle, normalizedType),
    `${slug}${extension}`
  );
}




export function findUserContentFilePath(
  handle: string,
  contentType: string,
  slug: string
): string | null {
  const normalizedType =
    CONTENT_TYPE_DIR_MAP[contentType] || (contentType as ContentType);
  const extensions = ['.md', '.mdx'];

  if (contentType === 'profile') {
    const profilePath = getUserProfilePath(handle);
    return existsSync(profilePath) ? profilePath : null;
  }

  const baseDir = getUserContentDir(handle, normalizedType);

  for (const ext of extensions) {
    const filePath = join(baseDir, `${slug}${ext}`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
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
        ownerHandle: handle,
      });
    } catch (error) {
      console.error(
        `[UserContentLoader] Failed to load ${filePath}:`,
        error
      );
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

function loadSingleFile(
  filePath: string,
  handle: string
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

    return {
      slug,
      metadata,
      content,
      filePath,
      ownerHandle: handle,
    };
  } catch (error) {
    console.error(
      `[UserContentLoader] Failed to load ${filePath}:`,
      error
    );
    return null;
  }
}
