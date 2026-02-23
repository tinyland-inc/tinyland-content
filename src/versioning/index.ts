



















import { nanoid } from 'nanoid';
import { createTwoFilesPatch } from 'diff';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getContentConfig, getLogger, withSpan } from '../config.js';
import type {
  ContentVersion,
  VersionIndex,
  VersionQuery,
  VersionComparison,
} from '../types.js';


export type { ContentVersion, VersionIndex, VersionQuery, VersionComparison };











export class VersionHistoryService {
  private get versionsDir(): string {
    const config = getContentConfig();
    return path.join(config.dataDir || './data', 'versions');
  }

  


  private async ensureVersionDirectory(
    contentType: string,
    slug: string
  ): Promise<string> {
    const versionPath = path.join(this.versionsDir, contentType, slug);
    await fs.mkdir(versionPath, { recursive: true });
    return versionPath;
  }

  


  private async getVersionIndex(
    contentType: string,
    slug: string
  ): Promise<VersionIndex> {
    const versionPath = await this.ensureVersionDirectory(contentType, slug);
    const indexPath = path.join(versionPath, 'versions.json');

    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(indexData);
    } catch {
      return {
        currentVersion: 0,
        versions: [],
      };
    }
  }

  


  private async saveVersionIndex(
    contentType: string,
    slug: string,
    index: VersionIndex
  ): Promise<void> {
    const versionPath = await this.ensureVersionDirectory(contentType, slug);
    const indexPath = path.join(versionPath, 'versions.json');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  


  private formatVersionNumber(version: number): string {
    return `v${version.toString().padStart(3, '0')}`;
  }

  


  private generateContentDiff(
    oldContent: string,
    newContent: string,
    slug: string
  ): string {
    return createTwoFilesPatch(
      `${slug}.md`,
      `${slug}.md`,
      oldContent,
      newContent,
      'previous version',
      'current version'
    );
  }

  


  private generateFrontmatterDiff(
    oldFrontmatter: Record<string, unknown>,
    newFrontmatter: Record<string, unknown>
  ): Record<string, { old: unknown; new: unknown }> {
    const diff: Record<string, { old: unknown; new: unknown }> = {};

    for (const key of Object.keys(newFrontmatter)) {
      if (
        JSON.stringify(oldFrontmatter[key]) !==
        JSON.stringify(newFrontmatter[key])
      ) {
        diff[key] = {
          old: oldFrontmatter[key],
          new: newFrontmatter[key],
        };
      }
    }

    for (const key of Object.keys(oldFrontmatter)) {
      if (!(key in newFrontmatter)) {
        diff[key] = {
          old: oldFrontmatter[key],
          new: undefined,
        };
      }
    }

    return diff;
  }

  











  async saveVersion(
    contentType: string,
    slug: string,
    frontmatter: Record<string, unknown>,
    content: string,
    changeType: ContentVersion['changeType'],
    createdBy: string,
    changeSummary?: string
  ): Promise<ContentVersion> {
    return withSpan('version_history.save_version', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', contentType);
      span?.setAttribute('content.slug', slug);
      span?.setAttribute('change.type', changeType);

      logger.info('Saving content version', {
        contentType,
        slug,
        changeType,
        createdBy,
      });

      const index = await this.getVersionIndex(contentType, slug);

      let previousVersion: ContentVersion | null = null;
      if (index.currentVersion > 0) {
        previousVersion = await this.getVersion(
          contentType,
          slug,
          index.currentVersion
        );
      }

      const newVersionNumber = index.currentVersion + 1;

      let diff: ContentVersion['diff'] | undefined;
      if (previousVersion) {
        const contentDiff = this.generateContentDiff(
          previousVersion.content,
          content,
          slug
        );
        const frontmatterDiff = this.generateFrontmatterDiff(
          previousVersion.frontmatter,
          frontmatter
        );
        diff = {
          contentDiff,
          frontmatterDiff,
        };
      }

      const version: ContentVersion = {
        id: nanoid(),
        contentType,
        slug,
        version: newVersionNumber,
        createdAt: new Date().toISOString(),
        createdBy,
        changeType,
        changeSummary,
        frontmatter,
        content,
        diff,
      };

      const versionPath = await this.ensureVersionDirectory(
        contentType,
        slug
      );
      const versionFile = path.join(
        versionPath,
        `${this.formatVersionNumber(newVersionNumber)}.json`
      );
      await fs.writeFile(
        versionFile,
        JSON.stringify(version, null, 2),
        'utf-8'
      );

      index.currentVersion = newVersionNumber;
      index.versions.push({
        version: newVersionNumber,
        createdAt: version.createdAt,
        changeType,
        createdBy,
        changeSummary,
      });
      await this.saveVersionIndex(contentType, slug, index);

      span?.setAttribute('version.number', newVersionNumber);
      logger.info('Version saved successfully', {
        contentType,
        slug,
        version: newVersionNumber,
        versionId: version.id,
      });

      return version;
    }) as Promise<ContentVersion>;
  }

  





  async getVersionHistory(query: VersionQuery): Promise<ContentVersion[]> {
    return withSpan('version_history.get_history', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', query.contentType);
      span?.setAttribute('content.slug', query.slug);

      logger.debug('Fetching version history', query as unknown as Record<string, unknown>);

      const index = await this.getVersionIndex(
        query.contentType,
        query.slug
      );

      if (index.versions.length === 0) {
        return [];
      }

      let versions = [...index.versions];
      if (query.before) {
        const beforeTime = new Date(query.before).getTime();
        versions = versions.filter(
          (v) => new Date(v.createdAt).getTime() < beforeTime
        );
      }
      if (query.after) {
        const afterTime = new Date(query.after).getTime();
        versions = versions.filter(
          (v) => new Date(v.createdAt).getTime() > afterTime
        );
      }

      versions.sort((a, b) => b.version - a.version);

      if (query.limit) {
        versions = versions.slice(0, query.limit);
      }

      const fullVersions = await Promise.all(
        versions.map((v) =>
          this.getVersion(query.contentType, query.slug, v.version)
        )
      );

      const validVersions = fullVersions.filter(
        (v): v is ContentVersion => v !== null
      );

      span?.setAttribute('versions.count', validVersions.length);

      return validVersions;
    }) as Promise<ContentVersion[]>;
  }

  


  async getVersion(
    contentType: string,
    slug: string,
    version: number
  ): Promise<ContentVersion | null> {
    const logger = getLogger();
    const versionPath = path.join(
      this.versionsDir,
      contentType,
      slug,
      `${this.formatVersionNumber(version)}.json`
    );

    try {
      const versionData = await fs.readFile(versionPath, 'utf-8');
      return JSON.parse(versionData);
    } catch (error) {
      logger.warn('Version not found', {
        contentType,
        slug,
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  


  async compareVersions(
    contentType: string,
    slug: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionComparison> {
    return withSpan('version_history.compare_versions', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', contentType);
      span?.setAttribute('content.slug', slug);

      logger.info('Comparing versions', {
        contentType,
        slug,
        fromVersion,
        toVersion,
      });

      const from = await this.getVersion(contentType, slug, fromVersion);
      const to = await this.getVersion(contentType, slug, toVersion);

      if (!from || !to) {
        throw new Error(
          `Version not found: ${!from ? fromVersion : toVersion}`
        );
      }

      const contentDiff = this.generateContentDiff(
        from.content,
        to.content,
        slug
      );
      const frontmatterDiff = this.generateFrontmatterDiff(
        from.frontmatter,
        to.frontmatter
      );

      return {
        from,
        to,
        frontmatterDiff,
        contentDiff,
      };
    }) as Promise<VersionComparison>;
  }

  





  async restoreVersion(
    contentType: string,
    slug: string,
    version: number,
    restoredBy: string
  ): Promise<ContentVersion> {
    return withSpan('version_history.restore_version', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', contentType);
      span?.setAttribute('content.slug', slug);
      span?.setAttribute('version.restore_from', version);

      logger.info('Restoring version', {
        contentType,
        slug,
        version,
        restoredBy,
      });

      const versionToRestore = await this.getVersion(
        contentType,
        slug,
        version
      );
      if (!versionToRestore) {
        throw new Error(`Version ${version} not found`);
      }

      const restoredVersion = await this.saveVersion(
        contentType,
        slug,
        versionToRestore.frontmatter,
        versionToRestore.content,
        'restore',
        restoredBy,
        `Restored from version ${version}`
      );

      span?.setAttribute('version.new_number', restoredVersion.version);
      logger.info('Version restored successfully', {
        contentType,
        slug,
        restoredFrom: version,
        newVersion: restoredVersion.version,
      });

      return restoredVersion;
    }) as Promise<ContentVersion>;
  }

  


  async pruneVersions(
    contentType: string,
    slug: string,
    keepCount: number = 50
  ): Promise<number> {
    return withSpan('version_history.prune_versions', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', contentType);
      span?.setAttribute('content.slug', slug);
      span?.setAttribute('keep.count', keepCount);

      logger.info('Pruning old versions', {
        contentType,
        slug,
        keepCount,
      });

      const index = await this.getVersionIndex(contentType, slug);

      if (index.versions.length <= keepCount) {
        logger.debug('No pruning needed', {
          contentType,
          slug,
          currentCount: index.versions.length,
          keepCount,
        });
        return 0;
      }

      const sortedVersions = [...index.versions].sort(
        (a, b) => b.version - a.version
      );

      const versionsToKeep = sortedVersions.slice(0, keepCount);
      const versionsToPrune = sortedVersions.slice(keepCount);

      const versionPath = path.join(this.versionsDir, contentType, slug);
      let prunedCount = 0;

      for (const version of versionsToPrune) {
        const versionFile = path.join(
          versionPath,
          `${this.formatVersionNumber(version.version)}.json`
        );
        try {
          await fs.unlink(versionFile);
          prunedCount++;
        } catch (error) {
          logger.warn('Failed to delete version file', {
            contentType,
            slug,
            version: version.version,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      index.versions = versionsToKeep;
      await this.saveVersionIndex(contentType, slug, index);

      span?.setAttribute('versions.pruned', prunedCount);
      logger.info('Versions pruned successfully', {
        contentType,
        slug,
        prunedCount,
        remainingCount: versionsToKeep.length,
      });

      return prunedCount;
    }) as Promise<number>;
  }

  


  async deleteAllVersions(
    contentType: string,
    slug: string
  ): Promise<number> {
    return withSpan('version_history.delete_all', async (span) => {
      const logger = getLogger();

      span?.setAttribute('content.type', contentType);
      span?.setAttribute('content.slug', slug);

      logger.warn('Deleting all versions', { contentType, slug });

      const versionPath = path.join(this.versionsDir, contentType, slug);

      try {
        const index = await this.getVersionIndex(contentType, slug);
        const count = index.versions.length;

        await fs.rm(versionPath, { recursive: true, force: true });

        span?.setAttribute('versions.deleted', count);
        logger.info('All versions deleted', {
          contentType,
          slug,
          deletedCount: count,
        });

        return count;
      } catch (error) {
        logger.error('Failed to delete versions', {
          contentType,
          slug,
          error: error instanceof Error ? error.message : String(error),
        });
        return 0;
      }
    }) as Promise<number>;
  }

  


  async getVersionStats(
    contentType: string,
    slug: string
  ): Promise<{
    totalVersions: number;
    oldestVersion: { version: number; createdAt: string } | null;
    newestVersion: { version: number; createdAt: string } | null;
    changeTypeCounts: Record<string, number>;
  }> {
    const index = await this.getVersionIndex(contentType, slug);

    if (index.versions.length === 0) {
      return {
        totalVersions: 0,
        oldestVersion: null,
        newestVersion: null,
        changeTypeCounts: {},
      };
    }

    const sorted = [...index.versions].sort(
      (a, b) => a.version - b.version
    );

    const changeTypeCounts: Record<string, number> = {};
    for (const version of index.versions) {
      changeTypeCounts[version.changeType] =
        (changeTypeCounts[version.changeType] || 0) + 1;
    }

    return {
      totalVersions: index.versions.length,
      oldestVersion: {
        version: sorted[0].version,
        createdAt: sorted[0].createdAt,
      },
      newestVersion: {
        version: sorted[sorted.length - 1].version,
        createdAt: sorted[sorted.length - 1].createdAt,
      },
      changeTypeCounts,
    };
  }
}














export function createVersionHistory(): VersionHistoryService {
  return new VersionHistoryService();
}
