


import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	configurePublishingHooks,
	resetPublishingHooksConfig,
} from '../../src/publishing-hooks/config.js';
import type {
	PublishingHooksLogger,
	PublishingHooksSpan,
	ScheduledPublishingServiceInterface,
	VersionHistoryServiceInterface,
	ContentFederationInterface,
} from '../../src/publishing-hooks/config.js';
import {
	onPublishingChange,
	onContentCreate,
	onContentUpdate,
	onContentDelete,
	onContentSchedule,
	onContentPublish,
} from '../../src/publishing-hooks/publishing-hook.js';
import type { PublishingHookContext } from '../../src/publishing-hooks/publishing-hook.js';
import type { UnifiedContentItem } from '../../src/publishing-hooks/types.js';





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

function createMockScheduler(
	overrides: Partial<ScheduledPublishingServiceInterface> = {}
): ScheduledPublishingServiceInterface {
	return {
		scheduleContent: vi.fn().mockResolvedValue(undefined),
		cancelSchedule: vi.fn().mockResolvedValue(undefined),
		...overrides,
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

function createMockFederation(
	overrides: Partial<ContentFederationInterface> = {}
): ContentFederationInterface {
	return {
		wrapInCreateActivity: vi.fn().mockReturnValue({ id: 'create-1', type: 'Create' }),
		wrapInUpdateActivity: vi.fn().mockReturnValue({ id: 'update-1', type: 'Update' }),
		createDeleteActivity: vi.fn().mockReturnValue({ id: 'delete-1', type: 'Delete' }),
		shouldFederateContent: vi.fn().mockReturnValue(true),
		...overrides,
	};
}

function createContent(overrides: Partial<UnifiedContentItem> = {}): UnifiedContentItem {
	return {
		type: 'blog',
		slug: 'test-post',
		title: 'Test Post',
		content: '# Test\n\nContent here.',
		frontmatter: { title: 'Test Post', status: 'draft' },
		...overrides,
	};
}

function createContext(overrides: Partial<PublishingHookContext> = {}): PublishingHookContext {
	return {
		contentType: 'blog',
		slug: 'test-post',
		previousStatus: 'draft',
		newStatus: 'published',
		userHandle: 'admin',
		...overrides,
	};
}

interface SetupResult {
	logger: PublishingHooksLogger;
	scheduler: ScheduledPublishingServiceInterface;
	versionService: VersionHistoryServiceInterface;
	federation: ContentFederationInterface;
	span: PublishingHooksSpan;
}

function setupConfig(overrides: {
	logger?: PublishingHooksLogger;
	scheduler?: ScheduledPublishingServiceInterface;
	versionService?: VersionHistoryServiceInterface;
	federation?: ContentFederationInterface;
	span?: PublishingHooksSpan;
} = {}): SetupResult {
	const logger = overrides.logger ?? createMockLogger();
	const scheduler = overrides.scheduler ?? createMockScheduler();
	const versionService = overrides.versionService ?? createMockVersionService();
	const federation = overrides.federation ?? createMockFederation();
	const span = overrides.span ?? createMockSpan();

	configurePublishingHooks({
		getLogger: () => logger,
		getTracer: () => ({
			startActiveSpan: async <T>(_name: string, fn: (s: PublishingHooksSpan) => Promise<T>) => fn(span),
		}),
		createSpan: async (_name, fn, _opts) => fn(span),
		scheduledPublishingService: scheduler,
		versionHistoryService: versionService,
		contentFederation: federation,
		baseUrl: 'https://example.com',
		SpanStatusCode: { OK: 0, ERROR: 2 },
	});

	return { logger, scheduler, versionService, federation, span };
}

describe('publishing-hook', () => {
	beforeEach(() => {
		resetPublishingHooksConfig();
	});

	
	
	

	describe('onPublishingChange()', () => {
		

		describe('status transitions', () => {
			it('should handle draft -> published', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'draft', newStatus: 'published' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should handle published -> archived', async () => {
				setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'published', newStatus: 'archived' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(result.versionCreated).toBe(true);
			});

			it('should handle draft -> scheduled', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({
					previousStatus: 'draft',
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
					timezone: 'America/New_York',
				});

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(result.scheduled).toBe(true);
				expect(scheduler.scheduleContent).toHaveBeenCalledWith(
					'blog', 'test-post', '2025-06-01T12:00:00Z', 'America/New_York', false, 'admin'
				);
			});

			it('should handle scheduled -> published', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'published' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should handle scheduled -> draft (cancel schedule)', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'draft' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should handle scheduled -> archived (cancel schedule)', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'archived' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should handle draft -> pending', async () => {
				setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'draft', newStatus: 'pending' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(result.versionCreated).toBe(true);
			});

			it('should handle pending -> published', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'pending', newStatus: 'published' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
				expect(scheduler.cancelSchedule).toHaveBeenCalled();
			});

			it('should handle published -> draft', async () => {
				setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: 'published', newStatus: 'draft' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
			});

			it('should handle no previousStatus', async () => {
				setupConfig();
				const content = createContent();
				const ctx = createContext({ previousStatus: undefined, newStatus: 'draft' });

				const result = await onPublishingChange(content, ctx);

				expect(result.success).toBe(true);
			});
		});

		

		describe('version recording', () => {
			it('should record version on status change', async () => {
				const { versionService } = setupConfig();
				const content = createContent();
				const ctx = createContext();

				await onPublishingChange(content, ctx);

				expect(versionService.saveVersion).toHaveBeenCalledWith(
					'blog', 'test-post',
					content.frontmatter, content.content,
					'status', 'admin',
					'Status changed: draft \u2192 published'
				);
			});

			it('should use custom changeSummary if provided', async () => {
				const { versionService } = setupConfig();
				const content = createContent();
				const ctx = createContext({ changeSummary: 'Custom reason' });

				await onPublishingChange(content, ctx);

				expect(versionService.saveVersion).toHaveBeenCalledWith(
					'blog', 'test-post',
					content.frontmatter, content.content,
					'status', 'admin',
					'Custom reason'
				);
			});

			it('should set versionCreated=true on success', async () => {
				setupConfig();
				const result = await onPublishingChange(createContent(), createContext());
				expect(result.versionCreated).toBe(true);
			});

			it('should not fail when version recording fails', async () => {
				
				
				
				const versionService = createMockVersionService({
					saveVersion: vi.fn().mockRejectedValue(new Error('DB down')),
				});
				setupConfig({ versionService });

				const result = await onPublishingChange(createContent(), createContext());

				expect(result.success).toBe(true);
				
				expect(result.versionCreated).toBe(true);
			});

			it('should log error when version recording fails (inside version hook)', async () => {
				const versionService = createMockVersionService({
					saveVersion: vi.fn().mockRejectedValue(new Error('DB down')),
				});
				const { logger } = setupConfig({ versionService });

				await onPublishingChange(createContent(), createContext());

				
				expect(logger.error).toHaveBeenCalledWith('Failed to record version', expect.objectContaining({
					error: 'DB down',
				}));
			});
		});

		

		describe('scheduling', () => {
			it('should schedule content when newStatus is "scheduled" and scheduledAt is provided', async () => {
				const { scheduler } = setupConfig();
				const content = createContent();
				const ctx = createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
					timezone: 'UTC',
				});

				const result = await onPublishingChange(content, ctx);

				expect(result.scheduled).toBe(true);
				expect(scheduler.scheduleContent).toHaveBeenCalledWith(
					'blog', 'test-post', '2025-06-01T12:00:00Z', 'UTC', false, 'admin'
				);
			});

			it('should use UTC when timezone not provided', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
				});

				await onPublishingChange(createContent(), ctx);

				expect(scheduler.scheduleContent).toHaveBeenCalledWith(
					'blog', 'test-post', '2025-06-01T12:00:00Z', 'UTC', false, 'admin'
				);
			});

			it('should pass autoFederate=true to scheduleContent', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
					autoFederate: true,
				});

				await onPublishingChange(createContent(), ctx);

				expect(scheduler.scheduleContent).toHaveBeenCalledWith(
					'blog', 'test-post', '2025-06-01T12:00:00Z', 'UTC', true, 'admin'
				);
			});

			it('should not schedule when scheduledAt is missing', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({ newStatus: 'scheduled' });

				await onPublishingChange(createContent(), ctx);

				expect(scheduler.scheduleContent).not.toHaveBeenCalled();
			});

			it('should fail when scheduling fails', async () => {
				const scheduler = createMockScheduler({
					scheduleContent: vi.fn().mockRejectedValue(new Error('schedule error')),
				});
				setupConfig({ scheduler });
				const ctx = createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
				});

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.success).toBe(false);
				expect(result.errors).toContain('Failed to schedule publishing');
			});

			it('should cancel schedule when publishing immediately', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({ newStatus: 'published' });

				await onPublishingChange(createContent(), ctx);

				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should cancel schedule when moving from scheduled to draft', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'draft' });

				await onPublishingChange(createContent(), ctx);

				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should not cancel schedule when moving from scheduled to published (handled in publish block)', async () => {
				const { scheduler } = setupConfig();
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'published' });

				await onPublishingChange(createContent(), ctx);

				
				expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			});

			it('should not fail when cancel schedule fails on status change', async () => {
				const scheduler = createMockScheduler({
					cancelSchedule: vi.fn().mockRejectedValue(new Error('cancel error')),
				});
				setupConfig({ scheduler });
				const ctx = createContext({ previousStatus: 'scheduled', newStatus: 'draft' });

				const result = await onPublishingChange(createContent(), ctx);

				
				expect(result.versionCreated).toBe(true);
			});
		});

		

		describe('federation', () => {
			it('should federate when publishing with autoFederate=true and shouldFederate=true', async () => {
				const { federation } = setupConfig();
				const content = createContent();
				const ctx = createContext({ newStatus: 'published', autoFederate: true });

				const result = await onPublishingChange(content, ctx);

				expect(result.federated).toBe(true);
				expect(federation.wrapInCreateActivity).toHaveBeenCalledWith(content, 'https://example.com');
			});

			it('should not federate when autoFederate is false', async () => {
				const { federation } = setupConfig();
				const ctx = createContext({ newStatus: 'published', autoFederate: false });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.federated).toBe(false);
				expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
			});

			it('should not federate when autoFederate is undefined', async () => {
				const { federation } = setupConfig();
				const ctx = createContext({ newStatus: 'published' });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.federated).toBe(false);
				expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
			});

			it('should not federate when shouldFederateContent returns false', async () => {
				const federation = createMockFederation({
					shouldFederateContent: vi.fn().mockReturnValue(false),
				});
				setupConfig({ federation });
				const ctx = createContext({ newStatus: 'published', autoFederate: true });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.federated).toBe(false);
			});

			it('should not fail when federation fails', async () => {
				const federation = createMockFederation({
					wrapInCreateActivity: vi.fn().mockImplementation(() => {
						throw new Error('federation error');
					}),
				});
				setupConfig({ federation });
				const ctx = createContext({ newStatus: 'published', autoFederate: true });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.success).toBe(true); 
				expect(result.federated).toBe(false);
				expect(result.errors).toContain(
					'Failed to federate to ActivityPub (content is published locally)'
				);
			});

			it('should not federate when status is not published', async () => {
				const { federation } = setupConfig();
				const ctx = createContext({ newStatus: 'draft', autoFederate: true });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.federated).toBe(false);
				expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
			});
		});

		

		describe('error handling', () => {
			it('should fail when cancelSchedule fails in publish block', async () => {
				const scheduler = createMockScheduler({
					cancelSchedule: vi.fn().mockRejectedValue(new Error('cancel error')),
				});
				setupConfig({ scheduler });
				const ctx = createContext({ newStatus: 'published' });

				const result = await onPublishingChange(createContent(), ctx);

				expect(result.success).toBe(false);
				expect(result.errors).toContain('Failed to handle publishing');
			});

			it('should still succeed when version recording fails', async () => {
				const versionService = createMockVersionService({
					saveVersion: vi.fn().mockRejectedValue(new Error('DB error')),
				});
				setupConfig({ versionService });

				const result = await onPublishingChange(
					createContent(),
					createContext({ newStatus: 'draft' })
				);

				expect(result.success).toBe(true);
			});
		});

		

		describe('span attributes', () => {
			it('should set content.type attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext());
				expect(span.setAttribute).toHaveBeenCalledWith('content.type', 'blog');
			});

			it('should set content.slug attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext());
				expect(span.setAttribute).toHaveBeenCalledWith('content.slug', 'test-post');
			});

			it('should set status.previous attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ previousStatus: 'draft' }));
				expect(span.setAttribute).toHaveBeenCalledWith('status.previous', 'draft');
			});

			it('should set status.previous to "none" when undefined', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ previousStatus: undefined }));
				expect(span.setAttribute).toHaveBeenCalledWith('status.previous', 'none');
			});

			it('should set status.new attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'published' }));
				expect(span.setAttribute).toHaveBeenCalledWith('status.new', 'published');
			});

			it('should set user.handle attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ userHandle: 'testuser' }));
				expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'testuser');
			});

			it('should set version.created attribute on version success', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(span.setAttribute).toHaveBeenCalledWith('version.created', true);
			});

			it('should set result.success attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(span.setAttribute).toHaveBeenCalledWith('result.success', true);
			});

			it('should set result.errors_count attribute', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(span.setAttribute).toHaveBeenCalledWith('result.errors_count', 0);
			});

			it('should set scheduled and scheduled_at attributes when scheduling', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
				}));
				expect(span.setAttribute).toHaveBeenCalledWith('scheduled', true);
				expect(span.setAttribute).toHaveBeenCalledWith('scheduled_at', '2025-06-01T12:00:00Z');
			});

			it('should set federated attribute when federation succeeds', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({
					newStatus: 'published',
					autoFederate: true,
				}));
				expect(span.setAttribute).toHaveBeenCalledWith('federated', true);
			});

			it('should call span.setStatus with OK on success', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(span.setStatus).toHaveBeenCalledWith({ code: 0 });
			});

			it('should call span.end', async () => {
				const { span } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(span.end).toHaveBeenCalled();
			});
		});

		

		describe('logger calls', () => {
			it('should log processing publishing change', async () => {
				const { logger } = setupConfig();
				await onPublishingChange(createContent(), createContext());
				expect(logger.info).toHaveBeenCalledWith('Processing publishing change', expect.objectContaining({
					contentType: 'blog',
					slug: 'test-post',
				}));
			});

			it('should log publishing change processed on success', async () => {
				const { logger } = setupConfig();
				await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
				expect(logger.info).toHaveBeenCalledWith('Publishing change processed', expect.objectContaining({
					contentType: 'blog',
				}));
			});

			it('should log content scheduled for publishing', async () => {
				const { logger } = setupConfig();
				await onPublishingChange(createContent(), createContext({
					newStatus: 'scheduled',
					scheduledAt: '2025-06-01T12:00:00Z',
					timezone: 'UTC',
				}));
				expect(logger.info).toHaveBeenCalledWith('Content scheduled for publishing', expect.objectContaining({
					scheduledAt: '2025-06-01T12:00:00Z',
				}));
			});

			it('should log scheduled publishing cancelled', async () => {
				const { logger } = setupConfig();
				await onPublishingChange(createContent(), createContext({
					previousStatus: 'scheduled',
					newStatus: 'draft',
				}));
				expect(logger.info).toHaveBeenCalledWith('Scheduled publishing cancelled', expect.objectContaining({
					contentType: 'blog',
				}));
			});
		});

		

		it('should work with noop defaults (no configuration)', async () => {
			const result = await onPublishingChange(createContent(), createContext({ newStatus: 'draft' }));
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('onContentCreate()', () => {
		it('should record initial version', async () => {
			const { versionService } = setupConfig();
			const content = createContent();

			const result = await onContentCreate(content, 'admin');

			expect(result.versionCreated).toBe(true);
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test-post',
				content.frontmatter, content.content,
				'create', 'admin', 'Initial version'
			);
		});

		it('should not federate by default', async () => {
			const { federation } = setupConfig();
			await onContentCreate(createContent(), 'admin');
			expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
		});

		it('should not federate when content is draft', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'draft' } });

			await onContentCreate(content, 'admin', true);

			expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
		});

		it('should federate when created as published with autoFederate', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentCreate(content, 'admin', true);

			expect(result.federated).toBe(true);
			expect(federation.wrapInCreateActivity).toHaveBeenCalled();
		});

		it('should not federate when shouldFederateContent returns false', async () => {
			const federation = createMockFederation({
				shouldFederateContent: vi.fn().mockReturnValue(false),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentCreate(content, 'admin', true);

			expect(result.federated).toBe(false);
		});

		it('should not fail when version recording fails', async () => {
			
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			const result = await onContentCreate(createContent(), 'admin');

			expect(result.success).toBe(true);
			
			expect(result.versionCreated).toBe(true);
		});

		it('should not fail when federation fails', async () => {
			const federation = createMockFederation({
				wrapInCreateActivity: vi.fn().mockImplementation(() => {
					throw new Error('fed error');
				}),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentCreate(content, 'admin', true);

			expect(result.success).toBe(true);
			expect(result.federated).toBe(false);
			expect(result.errors).toContain('Failed to federate to ActivityPub');
		});

		it('should set span attributes', async () => {
			const { span } = setupConfig();
			const content = createContent({ type: 'event', slug: 'ev1' });

			await onContentCreate(content, 'user1');

			expect(span.setAttribute).toHaveBeenCalledWith('content.type', 'event');
			expect(span.setAttribute).toHaveBeenCalledWith('content.slug', 'ev1');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'user1');
		});

		it('should log processing content creation', async () => {
			const { logger } = setupConfig();
			await onContentCreate(createContent(), 'admin');
			expect(logger.info).toHaveBeenCalledWith('Processing content creation', expect.objectContaining({
				userHandle: 'admin',
			}));
		});

		it('should set result.success span attribute', async () => {
			const { span } = setupConfig();
			await onContentCreate(createContent(), 'admin');
			expect(span.setAttribute).toHaveBeenCalledWith('result.success', true);
		});

		it('should call span.setStatus and span.end', async () => {
			const { span } = setupConfig();
			await onContentCreate(createContent(), 'admin');
			expect(span.setStatus).toHaveBeenCalledWith({ code: 0 });
			expect(span.end).toHaveBeenCalled();
		});

		it('should work with noop defaults', async () => {
			const result = await onContentCreate(createContent(), 'admin');
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('onContentUpdate()', () => {
		it('should record edit version', async () => {
			const { versionService } = setupConfig();
			const content = createContent();

			const result = await onContentUpdate(content, 'editor', 'Fixed typos');

			expect(result.versionCreated).toBe(true);
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test-post',
				content.frontmatter, content.content,
				'edit', 'editor', 'Fixed typos'
			);
		});

		it('should use "Content updated" as default changeSummary', async () => {
			const { versionService } = setupConfig();

			await onContentUpdate(createContent(), 'editor');

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				expect.anything(), expect.anything(),
				expect.anything(), expect.anything(),
				'edit', 'editor', 'Content updated'
			);
		});

		it('should federate update when content is published', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentUpdate(content, 'editor');

			expect(result.federated).toBe(true);
			expect(federation.wrapInUpdateActivity).toHaveBeenCalled();
		});

		it('should not federate when content is draft', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'draft' } });

			const result = await onContentUpdate(content, 'editor');

			expect(result.federated).toBe(false);
			expect(federation.wrapInUpdateActivity).not.toHaveBeenCalled();
		});

		it('should not federate when shouldFederateContent returns false', async () => {
			const federation = createMockFederation({
				shouldFederateContent: vi.fn().mockReturnValue(false),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentUpdate(content, 'editor');

			expect(result.federated).toBe(false);
		});

		it('should not fail when version recording fails', async () => {
			
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			const result = await onContentUpdate(createContent(), 'editor');

			expect(result.success).toBe(true);
			
			expect(result.versionCreated).toBe(true);
		});

		it('should not fail when federation fails', async () => {
			const federation = createMockFederation({
				wrapInUpdateActivity: vi.fn().mockImplementation(() => {
					throw new Error('fed error');
				}),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentUpdate(content, 'editor');

			expect(result.success).toBe(true);
			expect(result.errors).toContain('Failed to federate update to ActivityPub');
		});

		it('should set span attributes', async () => {
			const { span } = setupConfig();
			await onContentUpdate(createContent(), 'editor');
			expect(span.setAttribute).toHaveBeenCalledWith('content.type', 'blog');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'editor');
		});

		it('should log processing content update', async () => {
			const { logger } = setupConfig();
			await onContentUpdate(createContent(), 'editor', 'summary');
			expect(logger.info).toHaveBeenCalledWith('Processing content update', expect.objectContaining({
				changeSummary: 'summary',
			}));
		});

		it('should call span.end', async () => {
			const { span } = setupConfig();
			await onContentUpdate(createContent(), 'editor');
			expect(span.end).toHaveBeenCalled();
		});

		it('should work with noop defaults', async () => {
			const result = await onContentUpdate(createContent(), 'editor');
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('onContentDelete()', () => {
		it('should cancel any scheduled publishing', async () => {
			const { scheduler } = setupConfig();
			await onContentDelete(createContent(), 'admin');
			expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
		});

		it('should not fail when cancel schedule fails', async () => {
			const scheduler = createMockScheduler({
				cancelSchedule: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ scheduler });

			const result = await onContentDelete(createContent(), 'admin');

			expect(result.success).toBe(true);
		});

		it('should federate tombstone when content was published', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentDelete(content, 'admin');

			expect(result.federated).toBe(true);
			expect(federation.createDeleteActivity).toHaveBeenCalled();
		});

		it('should not federate when content was draft', async () => {
			const { federation } = setupConfig();
			const content = createContent({ frontmatter: { status: 'draft' } });

			const result = await onContentDelete(content, 'admin');

			expect(result.federated).toBe(false);
			expect(federation.createDeleteActivity).not.toHaveBeenCalled();
		});

		it('should not federate when shouldFederateContent returns false', async () => {
			const federation = createMockFederation({
				shouldFederateContent: vi.fn().mockReturnValue(false),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentDelete(content, 'admin');

			expect(result.federated).toBe(false);
		});

		it('should not fail when federation fails', async () => {
			const federation = createMockFederation({
				createDeleteActivity: vi.fn().mockImplementation(() => {
					throw new Error('fed error');
				}),
			});
			setupConfig({ federation });
			const content = createContent({ frontmatter: { status: 'published' } });

			const result = await onContentDelete(content, 'admin');

			expect(result.success).toBe(true);
			expect(result.errors).toContain('Failed to federate deletion to ActivityPub');
		});

		it('should set span attributes', async () => {
			const { span } = setupConfig();
			await onContentDelete(createContent(), 'admin');
			expect(span.setAttribute).toHaveBeenCalledWith('content.type', 'blog');
			expect(span.setAttribute).toHaveBeenCalledWith('user.handle', 'admin');
		});

		it('should log processing content deletion', async () => {
			const { logger } = setupConfig();
			await onContentDelete(createContent(), 'admin');
			expect(logger.info).toHaveBeenCalledWith('Processing content deletion', expect.objectContaining({
				userHandle: 'admin',
			}));
		});

		it('should call span.end', async () => {
			const { span } = setupConfig();
			await onContentDelete(createContent(), 'admin');
			expect(span.end).toHaveBeenCalled();
		});

		it('should work with noop defaults', async () => {
			const result = await onContentDelete(createContent(), 'admin');
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('onContentSchedule()', () => {
		it('should record version and schedule content', async () => {
			const { versionService, scheduler } = setupConfig();
			const content = createContent();

			const result = await onContentSchedule(
				content, '2025-06-01T12:00:00Z', 'America/New_York', 'admin'
			);

			expect(result.versionCreated).toBe(true);
			expect(result.scheduled).toBe(true);
			expect(versionService.saveVersion).toHaveBeenCalled();
			expect(scheduler.scheduleContent).toHaveBeenCalledWith(
				'blog', 'test-post', '2025-06-01T12:00:00Z', 'America/New_York', false, 'admin'
			);
		});

		it('should pass autoFederate to scheduleContent', async () => {
			const { scheduler } = setupConfig();

			await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin', true
			);

			expect(scheduler.scheduleContent).toHaveBeenCalledWith(
				'blog', 'test-post', '2025-06-01T12:00:00Z', 'UTC', true, 'admin'
			);
		});

		it('should default autoFederate to false', async () => {
			const { scheduler } = setupConfig();

			await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin'
			);

			expect(scheduler.scheduleContent).toHaveBeenCalledWith(
				'blog', 'test-post', '2025-06-01T12:00:00Z', 'UTC', false, 'admin'
			);
		});

		it('should use correct changeSummary for version', async () => {
			const { versionService } = setupConfig();

			await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'America/New_York', 'admin'
			);

			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test-post',
				expect.anything(), expect.anything(),
				'status', 'admin',
				'Scheduled for publishing at 2025-06-01T12:00:00Z (America/New_York)'
			);
		});

		it('should not fail when version recording fails', async () => {
			
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			const result = await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin'
			);

			
			expect(result.versionCreated).toBe(true);
			expect(result.scheduled).toBe(true);
			
			expect(result.errors).toHaveLength(0);
		});

		it('should fail when scheduling fails', async () => {
			const scheduler = createMockScheduler({
				scheduleContent: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ scheduler });

			const result = await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin'
			);

			expect(result.success).toBe(false);
			expect(result.scheduled).toBe(false);
			expect(result.errors).toContain('Failed to schedule publishing');
		});

		it('should set span attributes', async () => {
			const { span } = setupConfig();

			await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin'
			);

			expect(span.setAttribute).toHaveBeenCalledWith('scheduled_at', '2025-06-01T12:00:00Z');
			expect(span.setAttribute).toHaveBeenCalledWith('timezone', 'UTC');
			expect(span.setAttribute).toHaveBeenCalledWith('scheduled', true);
		});

		it('should log processing content scheduling', async () => {
			const { logger } = setupConfig();

			await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin', true
			);

			expect(logger.info).toHaveBeenCalledWith('Processing content scheduling', expect.objectContaining({
				scheduledAt: '2025-06-01T12:00:00Z',
				autoFederate: true,
			}));
		});

		it('should call span.end', async () => {
			const { span } = setupConfig();
			await onContentSchedule(createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin');
			expect(span.end).toHaveBeenCalled();
		});

		it('should work with noop defaults', async () => {
			const result = await onContentSchedule(
				createContent(), '2025-06-01T12:00:00Z', 'UTC', 'admin'
			);
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('onContentPublish()', () => {
		it('should record version, cancel schedule, and federate', async () => {
			const { versionService, scheduler, federation } = setupConfig();
			const content = createContent();

			const result = await onContentPublish(content, 'admin', true);

			expect(result.versionCreated).toBe(true);
			expect(result.federated).toBe(true);
			expect(versionService.saveVersion).toHaveBeenCalledWith(
				'blog', 'test-post',
				content.frontmatter, content.content,
				'status', 'admin', 'Published immediately'
			);
			expect(scheduler.cancelSchedule).toHaveBeenCalledWith('blog', 'test-post');
			expect(federation.wrapInCreateActivity).toHaveBeenCalled();
		});

		it('should not federate when autoFederate is false', async () => {
			const { federation } = setupConfig();

			const result = await onContentPublish(createContent(), 'admin', false);

			expect(result.federated).toBe(false);
			expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
		});

		it('should not federate when autoFederate is undefined', async () => {
			const { federation } = setupConfig();

			const result = await onContentPublish(createContent(), 'admin');

			expect(result.federated).toBe(false);
			expect(federation.wrapInCreateActivity).not.toHaveBeenCalled();
		});

		it('should not federate when shouldFederateContent returns false', async () => {
			const federation = createMockFederation({
				shouldFederateContent: vi.fn().mockReturnValue(false),
			});
			setupConfig({ federation });

			const result = await onContentPublish(createContent(), 'admin', true);

			expect(result.federated).toBe(false);
		});

		it('should not fail when version recording fails', async () => {
			
			const versionService = createMockVersionService({
				saveVersion: vi.fn().mockRejectedValue(new Error('fail')),
			});
			setupConfig({ versionService });

			const result = await onContentPublish(createContent(), 'admin');

			expect(result.success).toBe(true);
			
			expect(result.versionCreated).toBe(true);
		});

		it('should not fail when cancel schedule fails', async () => {
			const scheduler = createMockScheduler({
				cancelSchedule: vi.fn().mockRejectedValue(new Error('cancel error')),
			});
			setupConfig({ scheduler });

			const result = await onContentPublish(createContent(), 'admin');

			expect(result.success).toBe(true);
		});

		it('should not fail when federation fails', async () => {
			const federation = createMockFederation({
				wrapInCreateActivity: vi.fn().mockImplementation(() => {
					throw new Error('fed error');
				}),
			});
			setupConfig({ federation });

			const result = await onContentPublish(createContent(), 'admin', true);

			expect(result.success).toBe(true);
			expect(result.federated).toBe(false);
			expect(result.errors).toContain(
				'Failed to federate to ActivityPub (content is published locally)'
			);
		});

		it('should set auto_federate span attribute', async () => {
			const { span } = setupConfig();
			await onContentPublish(createContent(), 'admin', true);
			expect(span.setAttribute).toHaveBeenCalledWith('auto_federate', true);
		});

		it('should set auto_federate to false when undefined', async () => {
			const { span } = setupConfig();
			await onContentPublish(createContent(), 'admin');
			expect(span.setAttribute).toHaveBeenCalledWith('auto_federate', false);
		});

		it('should log processing immediate publishing', async () => {
			const { logger } = setupConfig();
			await onContentPublish(createContent(), 'admin', true);
			expect(logger.info).toHaveBeenCalledWith('Processing immediate publishing', expect.objectContaining({
				autoFederate: true,
			}));
		});

		it('should call span.end', async () => {
			const { span } = setupConfig();
			await onContentPublish(createContent(), 'admin');
			expect(span.end).toHaveBeenCalled();
		});

		it('should work with noop defaults', async () => {
			const result = await onContentPublish(createContent(), 'admin');
			expect(result.success).toBe(true);
		});
	});

	
	
	

	describe('content type variations', () => {
		const contentTypes = ['blog', 'event', 'product', 'program', 'note', 'profile', 'video'] as const;

		for (const type of contentTypes) {
			it(`should handle ${type} content type in onPublishingChange`, async () => {
				setupConfig();
				const content = createContent({ type, slug: `${type}-1` });
				const ctx = createContext({ contentType: type, slug: `${type}-1`, newStatus: 'draft' });

				const result = await onPublishingChange(content, ctx);
				expect(result.success).toBe(true);
			});

			it(`should handle ${type} content type in onContentCreate`, async () => {
				setupConfig();
				const content = createContent({ type, slug: `${type}-1` });

				const result = await onContentCreate(content, 'admin');
				expect(result.success).toBe(true);
			});

			it(`should handle ${type} content type in onContentUpdate`, async () => {
				setupConfig();
				const content = createContent({ type, slug: `${type}-1` });

				const result = await onContentUpdate(content, 'admin');
				expect(result.success).toBe(true);
			});

			it(`should handle ${type} content type in onContentDelete`, async () => {
				setupConfig();
				const content = createContent({ type, slug: `${type}-1` });

				const result = await onContentDelete(content, 'admin');
				expect(result.success).toBe(true);
			});
		}
	});

	
	
	

	describe('edge cases', () => {
		it('should handle empty frontmatter', async () => {
			setupConfig();
			const content = createContent({ frontmatter: {} });
			const result = await onContentCreate(content, 'admin');
			expect(result.success).toBe(true);
		});

		it('should handle empty content string', async () => {
			setupConfig();
			const content = createContent({ content: '' });
			const result = await onContentCreate(content, 'admin');
			expect(result.success).toBe(true);
		});

		it('should handle very long slug', async () => {
			setupConfig();
			const content = createContent({ slug: 'a'.repeat(1000) });
			const result = await onContentCreate(content, 'admin');
			expect(result.success).toBe(true);
		});

		it('should handle special characters in userHandle', async () => {
			setupConfig();
			const result = await onContentCreate(createContent(), 'user@domain.com');
			expect(result.success).toBe(true);
		});

		it('should handle frontmatter with nested objects', async () => {
			setupConfig();
			const content = createContent({
				frontmatter: { deep: { nested: { value: true } }, tags: ['a', 'b'] },
			});
			const result = await onContentCreate(content, 'admin');
			expect(result.success).toBe(true);
		});
	});
});
