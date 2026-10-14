


import { describe, it, expect, beforeEach } from 'vitest';
import {
	configurePublishingHooks,
	getPublishingHooksConfig,
	resetPublishingHooksConfig,
} from '../../src/publishing-hooks/config.js';
import type {
	PublishingHooksConfig,
	PublishingHooksLogger,
	PublishingHooksTracer,
	ScheduledPublishingServiceInterface,
	VersionHistoryServiceInterface,
	ContentFederationInterface,
} from '../../src/publishing-hooks/config.js';

describe('config', () => {
	beforeEach(() => {
		resetPublishingHooksConfig();
	});

	
	
	

	describe('getPublishingHooksConfig() defaults', () => {
		it('should return a fully resolved config with defaults', () => {
			const cfg = getPublishingHooksConfig();
			expect(cfg).toBeDefined();
			expect(cfg.getTracer).toBeTypeOf('function');
			expect(cfg.createSpan).toBeTypeOf('function');
			expect(cfg.SpanStatusCode).toBeDefined();
			expect(cfg.SpanKindINTERNAL).toBeDefined();
			expect(cfg.getLogger).toBeTypeOf('function');
			expect(cfg.scheduledPublishingService).toBeDefined();
			expect(cfg.versionHistoryService).toBeDefined();
			expect(cfg.contentFederation).toBeDefined();
			expect(cfg.baseUrl).toBeDefined();
		});

		it('should return default baseUrl as http://localhost:5174', () => {
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('http://localhost:5174');
		});

		it('should return default SpanStatusCode with OK=0 and ERROR=2', () => {
			const cfg = getPublishingHooksConfig();
			expect(cfg.SpanStatusCode.OK).toBe(0);
			expect(cfg.SpanStatusCode.ERROR).toBe(2);
		});

		it('should return default SpanKindINTERNAL as 0', () => {
			const cfg = getPublishingHooksConfig();
			expect(cfg.SpanKindINTERNAL).toBe(0);
		});
	});

	
	
	

	describe('default noop services', () => {
		it('should provide a noop tracer that executes the callback', async () => {
			const cfg = getPublishingHooksConfig();
			const tracer = cfg.getTracer();
			let called = false;
			await tracer.startActiveSpan('test', async (span) => {
				called = true;
				span.setAttribute('key', 'value');
				span.setStatus({ code: 0 });
				span.recordException(new Error('test'));
				span.end();
			});
			expect(called).toBe(true);
		});

		it('should provide a noop tracer that returns the callback result', async () => {
			const cfg = getPublishingHooksConfig();
			const tracer = cfg.getTracer();
			const result = await tracer.startActiveSpan('test', async () => 42);
			expect(result).toBe(42);
		});

		it('should provide a noop createSpan that executes the callback', async () => {
			const cfg = getPublishingHooksConfig();
			let called = false;
			await cfg.createSpan('test', async (span) => {
				called = true;
				span.setAttribute('key', 'value');
			});
			expect(called).toBe(true);
		});

		it('should provide a noop createSpan that accepts options', async () => {
			const cfg = getPublishingHooksConfig();
			let called = false;
			await cfg.createSpan('test', async () => { called = true; }, { kind: 0 });
			expect(called).toBe(true);
		});

		it('should provide a noop logger that does not throw', () => {
			const cfg = getPublishingHooksConfig();
			const logger = cfg.getLogger({ component: 'test' });
			expect(() => logger.info('msg')).not.toThrow();
			expect(() => logger.warn('msg')).not.toThrow();
			expect(() => logger.error('msg')).not.toThrow();
			expect(() => logger.debug('msg')).not.toThrow();
		});

		it('should provide a noop logger without scope arg', () => {
			const cfg = getPublishingHooksConfig();
			const logger = cfg.getLogger();
			expect(() => logger.info('msg', { key: 'value' })).not.toThrow();
		});

		it('should provide a noop scheduledPublishingService that resolves', async () => {
			const cfg = getPublishingHooksConfig();
			await expect(
				cfg.scheduledPublishingService.scheduleContent('blog', 'test', '2025-01-01', 'UTC', false, 'user')
			).resolves.toBeUndefined();
			await expect(
				cfg.scheduledPublishingService.cancelSchedule('blog', 'test')
			).resolves.toBeUndefined();
		});

		it('should provide a noop versionHistoryService that resolves', async () => {
			const cfg = getPublishingHooksConfig();
			const result = await cfg.versionHistoryService.saveVersion(
				'blog', 'test', {}, '', 'create', 'user'
			);
			expect(result).toEqual({ version: 0, id: 'noop' });
		});

		it('should provide a noop versionHistoryService that accepts changeSummary', async () => {
			const cfg = getPublishingHooksConfig();
			const result = await cfg.versionHistoryService.saveVersion(
				'blog', 'test', {}, '', 'edit', 'user', 'some summary'
			);
			expect(result).toEqual({ version: 0, id: 'noop' });
		});

		it('should provide a noop contentFederation.shouldFederateContent returning false', () => {
			const cfg = getPublishingHooksConfig();
			expect(cfg.contentFederation.shouldFederateContent({})).toBe(false);
		});

		it('should provide a noop contentFederation.wrapInCreateActivity', () => {
			const cfg = getPublishingHooksConfig();
			const activity = cfg.contentFederation.wrapInCreateActivity({}, 'http://localhost');
			expect(activity).toEqual({ id: 'noop', type: 'Create' });
		});

		it('should provide a noop contentFederation.wrapInUpdateActivity', () => {
			const cfg = getPublishingHooksConfig();
			const activity = cfg.contentFederation.wrapInUpdateActivity({}, 'http://localhost');
			expect(activity).toEqual({ id: 'noop', type: 'Update' });
		});

		it('should provide a noop contentFederation.createDeleteActivity', () => {
			const cfg = getPublishingHooksConfig();
			const activity = cfg.contentFederation.createDeleteActivity({}, 'http://localhost');
			expect(activity).toEqual({ id: 'noop', type: 'Delete' });
		});
	});

	
	
	

	describe('configurePublishingHooks()', () => {
		it('should merge baseUrl into config', () => {
			configurePublishingHooks({ baseUrl: 'https://example.com' });
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('https://example.com');
		});

		it('should merge getLogger into config', () => {
			const customLogger: PublishingHooksLogger = {
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				debug: vi.fn(),
			};
			configurePublishingHooks({ getLogger: () => customLogger });
			const cfg = getPublishingHooksConfig();
			const logger = cfg.getLogger({ component: 'test' });
			expect(logger).toBe(customLogger);
		});

		it('should merge getTracer into config', () => {
			const customTracer: PublishingHooksTracer = {
				startActiveSpan: vi.fn().mockImplementation(async (_name, fn) => fn({
					setAttribute: vi.fn(),
					setStatus: vi.fn(),
					recordException: vi.fn(),
					end: vi.fn(),
				})),
			};
			configurePublishingHooks({ getTracer: () => customTracer });
			const cfg = getPublishingHooksConfig();
			expect(cfg.getTracer()).toBe(customTracer);
		});

		it('should merge scheduledPublishingService into config', () => {
			const customService: ScheduledPublishingServiceInterface = {
				scheduleContent: vi.fn(),
				cancelSchedule: vi.fn(),
			};
			configurePublishingHooks({ scheduledPublishingService: customService });
			const cfg = getPublishingHooksConfig();
			expect(cfg.scheduledPublishingService).toBe(customService);
		});

		it('should merge versionHistoryService into config', () => {
			const customService: VersionHistoryServiceInterface = {
				saveVersion: vi.fn().mockResolvedValue({ version: 1, id: 'abc' }),
			};
			configurePublishingHooks({ versionHistoryService: customService });
			const cfg = getPublishingHooksConfig();
			expect(cfg.versionHistoryService).toBe(customService);
		});

		it('should merge contentFederation into config', () => {
			const customFederation: ContentFederationInterface = {
				wrapInCreateActivity: vi.fn().mockReturnValue({ id: 'c1', type: 'Create' }),
				wrapInUpdateActivity: vi.fn().mockReturnValue({ id: 'u1', type: 'Update' }),
				createDeleteActivity: vi.fn().mockReturnValue({ id: 'd1', type: 'Delete' }),
				shouldFederateContent: vi.fn().mockReturnValue(true),
			};
			configurePublishingHooks({ contentFederation: customFederation });
			const cfg = getPublishingHooksConfig();
			expect(cfg.contentFederation).toBe(customFederation);
		});

		it('should merge SpanStatusCode into config', () => {
			configurePublishingHooks({ SpanStatusCode: { OK: 1, ERROR: 3 } });
			const cfg = getPublishingHooksConfig();
			expect(cfg.SpanStatusCode).toEqual({ OK: 1, ERROR: 3 });
		});

		it('should merge SpanKindINTERNAL into config', () => {
			configurePublishingHooks({ SpanKindINTERNAL: 5 });
			const cfg = getPublishingHooksConfig();
			expect(cfg.SpanKindINTERNAL).toBe(5);
		});

		it('should accumulate multiple configure calls', () => {
			configurePublishingHooks({ baseUrl: 'https://first.com' });
			configurePublishingHooks({ SpanKindINTERNAL: 7 });
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('https://first.com');
			expect(cfg.SpanKindINTERNAL).toBe(7);
		});

		it('should override previous values on re-configure', () => {
			configurePublishingHooks({ baseUrl: 'https://first.com' });
			configurePublishingHooks({ baseUrl: 'https://second.com' });
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('https://second.com');
		});
	});

	
	
	

	describe('resetPublishingHooksConfig()', () => {
		it('should reset config so defaults are returned', () => {
			configurePublishingHooks({ baseUrl: 'https://example.com' });
			resetPublishingHooksConfig();
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('http://localhost:5174');
		});

		it('should reset all configured services', () => {
			const customService: ScheduledPublishingServiceInterface = {
				scheduleContent: vi.fn(),
				cancelSchedule: vi.fn(),
			};
			configurePublishingHooks({ scheduledPublishingService: customService });
			resetPublishingHooksConfig();
			const cfg = getPublishingHooksConfig();
			expect(cfg.scheduledPublishingService).not.toBe(customService);
		});

		it('should be idempotent', () => {
			resetPublishingHooksConfig();
			resetPublishingHooksConfig();
			const cfg = getPublishingHooksConfig();
			expect(cfg.baseUrl).toBe('http://localhost:5174');
		});
	});
});
