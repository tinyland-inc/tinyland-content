


import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	configurePublishingHooks,
	resetPublishingHooksConfig,
} from '../../src/publishing-hooks/config.js';
import type {
	PublishingHooksLogger,
	PublishingHooksSpan,
	VersionHistoryServiceInterface,
} from '../../src/publishing-hooks/config.js';
import {
	recordContentVersion,
	recordAutoVersion,
	recordCreateVersion,
	recordEditVersion,
	recordStatusChangeVersion,
} from '../../src/publishing-hooks/version-hook.js';





function createMockLogger(): PublishingHooksLogger {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};
}

function createMockSpan(): PublishingHooksSpan {
	return {
		setAttribute: vi.fn(),
		setStatus: vi.fn(),
		recordException: vi.fn(),
		end: vi.fn(),
	};
}

function createMockVersionService(
	overrides: Partial<VersionHistoryServiceInterface> = {}
): VersionHistoryServiceInterface {
	return {
		saveVersion: vi.fn().mockResolvedValue({ version: 1, id: 'ver-001' }),
		...overrides,
	};
}

function setupConfig(overrides: {
	logger?: PublishingHooksLogger;
	versionService?: VersionHistoryServiceInterface;
	span?: PublishingHooksSpan;
} = {}) {
	const logger = overrides.logger ?? createMockLogger();
	const versionService = overrides.versionService ?? createMockVersionService();
	const span = overrides.span ?? createMockSpan();

	configurePublishingHooks({
		getLogger: () => logger,
		versionHistoryService: versionService,
		createSpan: async (_name, fn, _options) => fn(span),
	});

	return { logger, versionService, span };
}

describe('version-hook', () => {
	beforeEach(() => {
		resetPublishingHooksConfig();
	});

	
	
	

	describe('recordContentVersion()', () => {
		it('should call versionHistoryService.saveVersion with correct args', async () => {
			const { versionService } = setupConfig();

			await recordContentVersion('blog', 'my-post', { title: 'Test' }, '# Hello', 'create', 'user1', 'Initial');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'my-post', { title: 'Test' }, '# Hello', 'create', 'user1', 'Initial'
			);
		});

		it('should call saveVersion without changeSummary when not provided', async () => {
			const { versionService } = setupConfig();

			await recordContentVersion('blog', 'my-post', {}, '', 'edit', 'user1');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'my-post', {}, '', 'edit', 'user1', undefined
			);
		});

		it('should set span attributes for content metadata', async () => {
			const { span } = setupConfig();

			await recordContentVersion('event', 'my-event', {}, '', 'status', 'user1');

			expect(span.setAttribute).toHaveBeenCalledWith('content.type', 'event');
			expect(span.setAttribute).toHaveBeenCalledWith('content.slug', 'my-event');
			expect(span.setAttribute).toHaveBeenCalledWith('change.type', 'status');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'user1');
		});

		it('should set version.number and version.id on success', async () => {
			const { span } = setupConfig();

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');

			expect(span.setAttribute).toHaveBeenCalledWith('version.number', 1);
			expect(span.setAttribute).toHaveBeenCalledWith('version.id', 'ver-001');
		});

		it('should log recording message', async () => {
			const { logger } = setupConfig();

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1', 'Initial');

			expect(logger.info).toHaveBeenCalledWith('Recording content version', {
				contentType: 'blog',
				slug: 'test',
				changeType: 'create',
				userHandle: 'user1',
				changeSummary: 'Initial'
			});
		});

		it('should log success message with version details', async () => {
			const { logger } = setupConfig();

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');

			expect(logger.info).toHaveBeenCalledWith('Version recorded successfully', {
				contentType: 'blog',
				slug: 'test',
				versionNumber: 1,
				versionId: 'ver-001'
			});
		});

		it('should handle changeType "create"', async () => {
			const { versionService } = setupConfig();
			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, '', 'create', 'user1', undefined
			);
		});

		it('should handle changeType "edit"', async () => {
			const { versionService } = setupConfig();
			await recordContentVersion('blog', 'test', {}, '', 'edit', 'user1');
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, '', 'edit', 'user1', undefined
			);
		});

		it('should handle changeType "status"', async () => {
			const { versionService } = setupConfig();
			await recordContentVersion('blog', 'test', {}, '', 'status', 'user1');
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, '', 'status', 'user1', undefined
			);
		});

		it('should handle changeType "restore"', async () => {
			const { versionService } = setupConfig();
			await recordContentVersion('blog', 'test', {}, '', 'restore', 'user1');
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, '', 'restore', 'user1', undefined
			);
		});

		it('should handle changeType "auto"', async () => {
			const { versionService } = setupConfig();
			await recordContentVersion('blog', 'test', {}, '', 'auto', 'system');
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, '', 'auto', 'system', undefined
			);
		});

		it('should not throw when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('DB down')),
			});
			setupConfig({ versionService });

			await expect(
				recordContentVersion('blog', 'test', {}, '', 'create', 'user1')
			).resolves.toBeUndefined();
		});

		it('should log error when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('DB down')),
			});
			const { logger } = setupConfig({ versionService });

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');

			expect(logger.error).toHaveBeenCalledWith('Failed to record version', {
				error: 'DB down',
				contentType: 'blog',
				slug: 'test',
				changeType: 'create'
			});
		});

		it('should call span.recordException when saveVersion fails', async () => {
			const error = new Error('DB down');
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(error),
			});
			const { span } = setupConfig({ versionService });

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');

			expect(span.recordException).toHaveBeenCalledWith(error);
		});

		it('should stringify non-Error exceptions in log', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue('string error'),
			});
			const { logger } = setupConfig({ versionService });

			await recordContentVersion('blog', 'test', {}, '', 'create', 'user1');

			expect(logger.error).toHaveBeenCalledWith('Failed to record version', expect.objectContaining({
				error: 'string error',
			}));
		});

		it('should work with noop defaults (no configuration)', async () => {
			
			await expect(
				recordContentVersion('blog', 'test', {}, '', 'create', 'user1')
			).resolves.toBeUndefined();
		});

		it('should handle various content types', async () => {
			const { versionService } = setupConfig();

			const types = ['blog', 'event', 'product', 'program', 'note', 'profile', 'video'];
			for (const type of types) {
				await recordContentVersion(type, 'test', {}, '', 'create', 'user1');
			}

			expect(versionService.saveVersion).toHaveBeenCalledTimes(types.length);
		});

		it('should pass complex frontmatter correctly', async () => {
			const { versionService } = setupConfig();
			const fm = { title: 'Test', tags: ['a', 'b'], nested: { key: 'val' } };

			await recordContentVersion('blog', 'test', fm, '', 'edit', 'user1');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', fm, '', 'edit', 'user1', undefined
			);
		});

		it('should pass multiline content correctly', async () => {
			const { versionService } = setupConfig();
			const content = '# Title\n\nParagraph 1\n\nParagraph 2';

			await recordContentVersion('blog', 'test', {}, content, 'edit', 'user1');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', {}, content, 'edit', 'user1', undefined
			);
		});

		it('should handle version numbers > 1', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockResolvedValue({ version: 42, id: 'ver-042' }),
			});
			const { span } = setupConfig({ versionService });

			await recordContentVersion('blog', 'test', {}, '', 'edit', 'user1');

			expect(span.setAttribute).toHaveBeenCalledWith('version.number', 42);
			expect(span.setAttribute).toHaveBeenCalledWith('version.id', 'ver-042');
		});
	});

	
	
	

	describe('recordAutoVersion()', () => {
		it('should delegate to recordContentVersion with "auto" changeType and "system" userHandle', async () => {
			const { versionService } = setupConfig();

			await recordAutoVersion('blog', 'test', { title: 'Auto' }, '# Auto', 'Scheduled publish');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test', { title: 'Auto' }, '# Auto', 'auto', 'system', 'Scheduled publish'
			);
		});

		it('should pass changeSummary correctly', async () => {
			const { versionService } = setupConfig();

			await recordAutoVersion('event', 'ev1', {}, '', 'System-triggered status change');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'event', 'ev1', {}, '', 'auto', 'system', 'System-triggered status change'
			);
		});

		it('should not throw when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			await expect(
				recordAutoVersion('blog', 'test', {}, '', 'summary')
			).resolves.toBeUndefined();
		});

		it('should set span attributes correctly', async () => {
			const { span } = setupConfig();

			await recordAutoVersion('blog', 'test', {}, '', 'summary');

			expect(span.setAttribute).toHaveBeenCalledWith('change.type', 'auto');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'system');
		});
	});

	
	
	

	describe('recordCreateVersion()', () => {
		it('should delegate to recordContentVersion with "create" and "Initial version"', async () => {
			const { versionService } = setupConfig();

			await recordCreateVersion('blog', 'new-post', { title: 'New' }, '# New', 'admin');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'new-post', { title: 'New' }, '# New', 'create', 'admin', 'Initial version'
			);
		});

		it('should always use "Initial version" as changeSummary', async () => {
			const { versionService } = setupConfig();

			await recordCreateVersion('event', 'ev1', {}, '', 'user2');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'event', 'ev1', {}, '', 'create', 'user2', 'Initial version'
			);
		});

		it('should not throw when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			await expect(
				recordCreateVersion('blog', 'test', {}, '', 'user1')
			).resolves.toBeUndefined();
		});

		it('should set correct span attributes', async () => {
			const { span } = setupConfig();

			await recordCreateVersion('blog', 'test', {}, '', 'user1');

			expect(span.setAttribute).toHaveBeenCalledWith('change.type', 'create');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'user1');
		});
	});

	
	
	

	describe('recordEditVersion()', () => {
		it('should delegate to recordContentVersion with "edit"', async () => {
			const { versionService } = setupConfig();

			await recordEditVersion('blog', 'post', {}, '', 'user1', 'Fixed typo');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'post', {}, '', 'edit', 'user1', 'Fixed typo'
			);
		});

		it('should allow undefined changeSummary', async () => {
			const { versionService } = setupConfig();

			await recordEditVersion('blog', 'post', {}, '', 'user1');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'post', {}, '', 'edit', 'user1', undefined
			);
		});

		it('should not throw when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			await expect(
				recordEditVersion('blog', 'test', {}, '', 'user1')
			).resolves.toBeUndefined();
		});

		it('should set correct span attributes', async () => {
			const { span } = setupConfig();

			await recordEditVersion('blog', 'test', {}, '', 'editor');

			expect(span.setAttribute).toHaveBeenCalledWith('change.type', 'edit');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'editor');
		});
	});

	
	
	

	describe('recordStatusChangeVersion()', () => {
		it('should delegate to recordContentVersion with "status" and formatted message', async () => {
			const { versionService } = setupConfig();

			await recordStatusChangeVersion('blog', 'post', {}, '', 'user1', 'draft', 'published');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'post', {}, '', 'status', 'user1', 'Status changed: draft \u2192 published'
			);
		});

		it('should format message for archived status change', async () => {
			const { versionService } = setupConfig();

			await recordStatusChangeVersion('blog', 'post', {}, '', 'admin', 'published', 'archived');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'post', {}, '', 'status', 'admin',
				'Status changed: published \u2192 archived'
			);
		});

		it('should format message for scheduled status change', async () => {
			const { versionService } = setupConfig();

			await recordStatusChangeVersion('event', 'ev', {}, '', 'user1', 'draft', 'scheduled');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'event', 'ev', {}, '', 'status', 'user1',
				'Status changed: draft \u2192 scheduled'
			);
		});

		it('should format message for pending status change', async () => {
			const { versionService } = setupConfig();

			await recordStatusChangeVersion('blog', 'p', {}, '', 'user1', 'draft', 'pending');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'p', {}, '', 'status', 'user1',
				'Status changed: draft \u2192 pending'
			);
		});

		it('should not throw when saveVersion fails', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			await expect(
				recordStatusChangeVersion('blog', 'test', {}, '', 'user1', 'draft', 'published')
			).resolves.toBeUndefined();
		});

		it('should log error on failure', async () => {
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			const { logger } = setupConfig({ versionService });

			await recordStatusChangeVersion('blog', 'test', {}, '', 'user1', 'draft', 'published');

			expect(logger.error).toHaveBeenCalledWith('Failed to record version', expect.objectContaining({
				error: 'fail',
			}));
		});

		it('should set correct span attributes', async () => {
			const { span } = setupConfig();

			await recordStatusChangeVersion('blog', 'test', {}, '', 'admin', 'draft', 'published');

			expect(span.setAttribute).toHaveBeenCalledWith('change.type', 'status');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'admin');
		});
	});
});
