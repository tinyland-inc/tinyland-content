/**
 * Scheduled Publishing Service
 *
 * Handles automatic publishing of scheduled content.
 * Federation behavior (ActivityPub) is replaced with optional publish hooks
 * that allow the ActivityPub package to inject federation behavior later.
 *
 * @module scheduling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { getContentConfig, getLogger, withSpan } from '../config.js';
import type {
  ContentType,
  ScheduledItem,
  PublishResult,
  PublishHooks,
  ScheduleStorage,
  ContentItem,
} from '../types.js';

// Re-export types
export type { ScheduledItem, PublishResult, PublishHooks, ScheduleStorage };

// ============================================================================
// Scheduled Publishing Service
// ============================================================================

/**
 * Scheduled Publishing Service
 *
 * Manages scheduling and automatic publishing of content items.
 * Uses config injection for data directory and optional publish hooks
 * for extensibility (e.g., ActivityPub federation).
 */
export class ScheduledPublishingService {
  private cronJob: { stop(): void } | null = null;
  private initialized = false;
  private processing = false;
  private hooks: PublishHooks = {};

  private get scheduleFile(): string {
    const config = getContentConfig();
    return path.join(config.dataDir || './data', 'scheduled-publishing.json');
  }

  /**
   * Set publish hooks for extensibility (e.g., ActivityPub federation)
   *
   * @example
   * ```typescript
   * scheduler.setHooks({
   *   onPublish: async (item) => {
   *     await federateContent(item); // ActivityPub Create activity
   *   },
   *   onUnpublish: async (item) => {
   *     await defederateContent(item); // ActivityPub Delete activity
   *   },
   * });
   * ```
   */
  setHooks(hooks: PublishHooks): void {
    this.hooks = hooks;
  }

  /**
   * Initialize the cron job (call on server startup)
   *
   * Requires optional peer dependency `node-cron`.
   */
  async initialize(): Promise<void> {
    return withSpan('scheduled_publishing.initialize', async (span) => {
      const logger = getLogger();

      if (this.initialized) {
        span?.setAttribute('already_initialized', true);
        return;
      }

      await this.ensureDataDirectory();

      if (!(await this.fileExists(this.scheduleFile))) {
        await this.writeScheduleFile({
          items: [],
          lastProcessed: new Date().toISOString(),
        });
      }

      // Dynamically import node-cron (optional peer dependency)
      try {
        const cron = await import('node-cron');
        this.cronJob = cron.default.schedule('* * * * *', async () => {
          try {
            await this.processScheduledItems();
          } catch (error) {
            logger.error(
              '[ScheduledPublishing] Error processing scheduled items:',
              { error: error instanceof Error ? error.message : String(error) }
            );
          }
        });
      } catch {
        logger.warn(
          '[ScheduledPublishing] node-cron not available. Cron job not started. Call processScheduledItems() manually.'
        );
      }

      this.initialized = true;
      span?.setAttribute('initialized', true);

      logger.info('[ScheduledPublishing] Service initialized');
    }) as Promise<void>;
  }

  /**
   * Schedule content for publishing
   */
  async scheduleContent(
    contentType: ContentType,
    slug: string,
    scheduledAt: string,
    timezone: string,
    autoFederate: boolean,
    createdBy: string
  ): Promise<ScheduledItem> {
    return withSpan('scheduled_publishing.schedule_content', async (span) => {
      span?.setAttribute('content_type', contentType);
      span?.setAttribute('slug', slug);

      const schedule = await this.readScheduleFile();

      const existingIndex = schedule.items.findIndex(
        (item) => item.contentType === contentType && item.slug === slug
      );

      const scheduledItem: ScheduledItem = {
        id:
          existingIndex >= 0
            ? schedule.items[existingIndex].id
            : crypto.randomUUID(),
        contentType,
        slug,
        scheduledAt,
        timezone,
        autoFederate,
        createdBy,
        createdAt:
          existingIndex >= 0
            ? schedule.items[existingIndex].createdAt
            : new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        schedule.items[existingIndex] = scheduledItem;
        span?.setAttribute('action', 'updated');
      } else {
        schedule.items.push(scheduledItem);
        span?.setAttribute('action', 'created');
      }

      await this.writeScheduleFile(schedule);

      span?.setAttribute('scheduled_item_id', scheduledItem.id);

      return scheduledItem;
    }) as Promise<ScheduledItem>;
  }

  /**
   * Cancel scheduled publishing
   */
  async cancelSchedule(
    contentType: ContentType,
    slug: string
  ): Promise<boolean> {
    return withSpan('scheduled_publishing.cancel_schedule', async (span) => {
      span?.setAttribute('content_type', contentType);
      span?.setAttribute('slug', slug);

      const schedule = await this.readScheduleFile();
      const initialLength = schedule.items.length;

      schedule.items = schedule.items.filter(
        (item) =>
          !(item.contentType === contentType && item.slug === slug)
      );

      const removed = initialLength > schedule.items.length;

      if (removed) {
        await this.writeScheduleFile(schedule);
      }

      span?.setAttribute('removed', removed);

      return removed;
    }) as Promise<boolean>;
  }

  /**
   * Get all scheduled items
   */
  async getScheduledItems(): Promise<ScheduledItem[]> {
    return withSpan('scheduled_publishing.get_scheduled_items', async (span) => {
      const schedule = await this.readScheduleFile();

      const sorted = schedule.items.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
      );

      span?.setAttribute('item_count', sorted.length);

      return sorted;
    }) as Promise<ScheduledItem[]>;
  }

  /**
   * Get scheduled item for specific content
   */
  async getScheduledItem(
    contentType: ContentType,
    slug: string
  ): Promise<ScheduledItem | null> {
    return withSpan('scheduled_publishing.get_scheduled_item', async (span) => {
      span?.setAttribute('content_type', contentType);
      span?.setAttribute('slug', slug);

      const schedule = await this.readScheduleFile();
      const item = schedule.items.find(
        (i) => i.contentType === contentType && i.slug === slug
      );

      span?.setAttribute('found', !!item);

      return item || null;
    }) as Promise<ScheduledItem | null>;
  }

  /**
   * Process items ready for publishing (called by cron or manually)
   */
  async processScheduledItems(): Promise<PublishResult[]> {
    return withSpan(
      'scheduled_publishing.process_scheduled_items',
      async (span) => {
        const logger = getLogger();

        if (this.processing) {
          span?.setAttribute('skipped', 'already_processing');
          return [];
        }

        this.processing = true;

        try {
          const schedule = await this.readScheduleFile();
          const now = new Date();
          const results: PublishResult[] = [];

          const dueItems = schedule.items.filter((item) => {
            const scheduledTime = new Date(item.scheduledAt);
            return scheduledTime <= now;
          });

          span?.setAttribute('due_item_count', dueItems.length);

          for (const item of dueItems) {
            try {
              const result = await this.publishItem(item);
              results.push(result);

              if (result.success) {
                schedule.items = schedule.items.filter(
                  (i) => i.id !== item.id
                );
              }
            } catch (error) {
              logger.error(
                `[ScheduledPublishing] Failed to publish ${item.contentType}/${item.slug}:`,
                {
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error',
                }
              );

              results.push({
                success: false,
                contentType: item.contentType,
                slug: item.slug,
                publishedAt: now.toISOString(),
                federated: false,
                federationError:
                  error instanceof Error
                    ? error.message
                    : 'Unknown error',
              });
            }
          }

          schedule.lastProcessed = now.toISOString();
          await this.writeScheduleFile(schedule);

          span?.setAttribute(
            'success_count',
            results.filter((r) => r.success).length
          );
          span?.setAttribute(
            'failure_count',
            results.filter((r) => !r.success).length
          );

          return results;
        } finally {
          this.processing = false;
        }
      }
    ) as Promise<PublishResult[]>;
  }

  /**
   * Publish a single item
   */
  private async publishItem(item: ScheduledItem): Promise<PublishResult> {
    return withSpan('scheduled_publishing.publish_item', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content_type', item.contentType);
      span?.setAttribute('slug', item.slug);
      span?.setAttribute('auto_federate', item.autoFederate);

      const publishedAt = new Date().toISOString();

      // Update content file to set status to 'published'
      const contentPath = this.getContentFilePath(
        item.contentType,
        item.slug
      );
      const fileContent = await fs.readFile(contentPath, 'utf-8');
      const parsed = matter(fileContent);

      parsed.data.status = 'published';
      parsed.data.published = true;
      if (!parsed.data.publishedAt) {
        parsed.data.publishedAt = publishedAt;
      }
      parsed.data.updatedAt = publishedAt;

      const updatedContent = matter.stringify(parsed.content, parsed.data);
      await fs.writeFile(contentPath, updatedContent, 'utf-8');

      span?.setAttribute('file_updated', true);

      // Call publish hook if set (replaces federation logic)
      let federated = false;
      let federationError: string | undefined;

      if (item.autoFederate && this.hooks.onPublish) {
        try {
          const contentItem: ContentItem = {
            type: item.contentType,
            slug: item.slug,
            content: parsed.content,
            metadata: parsed.data,
            publishedAt: parsed.data.publishedAt as string,
            updatedAt: parsed.data.updatedAt as string,
            authorHandle:
              (parsed.data.author as string) || 'admin',
            visibility:
              (parsed.data.visibility as ContentItem['visibility']) ||
              'public',
          };

          await this.hooks.onPublish(contentItem);
          federated = true;
          span?.setAttribute('federated', true);
        } catch (error) {
          federationError =
            error instanceof Error
              ? error.message
              : 'Hook execution failed';
          span?.setAttribute('federation_error', federationError);
          logger.error('[ScheduledPublishing] onPublish hook failed:', {
            error: federationError,
          });
        }
      }

      return {
        success: true,
        contentType: item.contentType,
        slug: item.slug,
        publishedAt,
        federated,
        federationError,
      };
    }) as Promise<PublishResult>;
  }

  /**
   * Stop the cron job (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    return withSpan('scheduled_publishing.shutdown', async (span) => {
      const logger = getLogger();

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      this.initialized = false;

      span?.setAttribute('shutdown', true);
      logger.info('[ScheduledPublishing] Service shut down');
    }) as Promise<void>;
  }

  // ============================================================================
  // File System Helpers
  // ============================================================================

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.scheduleFile);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async readScheduleFile(): Promise<ScheduleStorage> {
    try {
      const content = await fs.readFile(this.scheduleFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { items: [], lastProcessed: new Date().toISOString() };
    }
  }

  private async writeScheduleFile(schedule: ScheduleStorage): Promise<void> {
    await fs.writeFile(
      this.scheduleFile,
      JSON.stringify(schedule, null, 2),
      'utf-8'
    );
  }

  private getContentFilePath(
    contentType: ContentType,
    slug: string
  ): string {
    const config = getContentConfig();
    const contentDirs: Record<ContentType, string> = {
      blog: 'blog',
      note: 'notes',
      event: 'events',
      program: 'programs',
      product: 'products',
      video: 'videos',
      profile: 'profiles',
    };

    const dir = contentDirs[contentType];

    // Default to .md
    return path.join(config.contentDir, dir, `${slug}.md`);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a ScheduledPublishingService instance.
 *
 * @param hooks - Optional publish hooks for federation extensibility
 *
 * @example
 * ```typescript
 * const scheduler = createScheduledPublisher({
 *   onPublish: async (item) => {
 *     console.log('Published:', item.slug);
 *   }
 * });
 * await scheduler.initialize();
 * ```
 */
export function createScheduledPublisher(
  hooks?: PublishHooks
): ScheduledPublishingService {
  const service = new ScheduledPublishingService();
  if (hooks) {
    service.setHooks(hooks);
  }
  return service;
}
