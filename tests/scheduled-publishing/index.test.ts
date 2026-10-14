











import {
  configure,
  getCurrentConfig,
  resetConfig,
  isInitialized,
  initializeScheduledPublishing,
  shutdownScheduledPublishing,
} from '../../src/scheduled-publishing/index.js';

import type {
  ScheduledPublishingService,
  ScheduledPublishingLogger,
} from '../../src/scheduled-publishing/index.js';



function createMockService(overrides?: Partial<ScheduledPublishingService>): ScheduledPublishingService {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockLogger(): ScheduledPublishingLogger & {
  log: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}



describe('@tummycrypt/tinyland-scheduled-publishing', () => {
  afterEach(() => {
    resetConfig();
  });

  
  
  
  describe('configure / getCurrentConfig / resetConfig', () => {
    it('should store configuration via configure()', () => {
      const service = createMockService();
      configure({ service });
      const cfg = getCurrentConfig();
      expect(cfg).not.toBeNull();
      expect(cfg!.service).toBe(service);
    });

    it('should return null from getCurrentConfig before configure() is called', () => {
      expect(getCurrentConfig()).toBeNull();
    });

    it('should overwrite previous configuration when configure() is called again', () => {
      const service1 = createMockService();
      const service2 = createMockService();
      configure({ service: service1 });
      configure({ service: service2 });
      expect(getCurrentConfig()!.service).toBe(service2);
    });

    it('should clear configuration and initialized state on resetConfig()', () => {
      const service = createMockService();
      configure({ service });
      resetConfig();
      expect(getCurrentConfig()).toBeNull();
      expect(isInitialized()).toBe(false);
    });

    it('should throw when configure() is called without a service', () => {
      expect(() => configure({ service: null as unknown as ScheduledPublishingService })).toThrow(
        '[ScheduledPublishing] configure() requires a service.'
      );
    });
  });

  
  
  
  describe('initializeScheduledPublishing', () => {
    it('should call service.initialize() on first call', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      expect(service.initialize).toHaveBeenCalledTimes(1);
    });

    it('should set isInitialized() to true after successful init', async () => {
      const service = createMockService();
      configure({ service });
      expect(isInitialized()).toBe(false);
      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);
    });

    it('should skip initialization on second call (idempotent)', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      await initializeScheduledPublishing();
      expect(service.initialize).toHaveBeenCalledTimes(1);
    });

    it('should not set initialized flag when service.initialize() throws', async () => {
      const error = new Error('init failed');
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(error),
      });
      configure({ service });
      await expect(initializeScheduledPublishing()).rejects.toThrow('init failed');
      expect(isInitialized()).toBe(false);
    });

    it('should re-throw the error from service.initialize()', async () => {
      const error = new Error('cron setup failure');
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(error),
      });
      configure({ service });
      await expect(initializeScheduledPublishing()).rejects.toBe(error);
    });

    it('should throw if not configured', async () => {
      await expect(initializeScheduledPublishing()).rejects.toThrow(
        '[ScheduledPublishing] Not configured'
      );
    });

    it('should log "Initializing cron job..." before calling service', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      expect(logger.log).toHaveBeenCalledWith(
        '[ScheduledPublishing] Initializing cron job...'
      );
    });

    it('should log success after service.initialize() completes', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      expect(logger.log).toHaveBeenCalledWith(
        '[ScheduledPublishing] Cron job initialized successfully'
      );
    });

    it('should log "Already initialized, skipping" on second call', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await initializeScheduledPublishing();
      expect(logger.log).toHaveBeenCalledWith(
        '[ScheduledPublishing] Already initialized, skipping'
      );
    });

    it('should log error when service.initialize() throws', async () => {
      const error = new Error('boom');
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(error),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await expect(initializeScheduledPublishing()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        '[ScheduledPublishing] Failed to initialize cron job:',
        error
      );
    });

    it('should not log success when service.initialize() throws', async () => {
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await expect(initializeScheduledPublishing()).rejects.toThrow();
      expect(logger.log).not.toHaveBeenCalledWith(
        '[ScheduledPublishing] Cron job initialized successfully'
      );
    });

    it('should allow retry after a failed initialization', async () => {
      let callCount = 0;
      const service = createMockService({
        initialize: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('transient failure');
        }),
      });
      configure({ service });
      await expect(initializeScheduledPublishing()).rejects.toThrow('transient failure');
      expect(isInitialized()).toBe(false);
      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);
    });

    it('should call service.initialize only once even with concurrent calls', async () => {
      let resolveInit: () => void;
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      const service = createMockService({
        initialize: vi.fn().mockReturnValue(initPromise),
      });
      configure({ service });
      const p1 = initializeScheduledPublishing();
      const p2 = initializeScheduledPublishing();
      resolveInit!();
      await p1;
      await p2;
      
      
      
      
      
      expect(service.initialize).toHaveBeenCalledTimes(2);
    });

    it('should return void on successful initialization', async () => {
      const service = createMockService();
      configure({ service });
      const result = await initializeScheduledPublishing();
      expect(result).toBeUndefined();
    });
  });

  
  
  
  describe('shutdownScheduledPublishing', () => {
    it('should call service.shutdown() when initialized', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      expect(service.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should set isInitialized() to false after successful shutdown', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);
      await shutdownScheduledPublishing();
      expect(isInitialized()).toBe(false);
    });

    it('should be a no-op when not initialized', async () => {
      const service = createMockService();
      configure({ service });
      await shutdownScheduledPublishing();
      expect(service.shutdown).not.toHaveBeenCalled();
    });

    it('should not set initialized flag to false when service.shutdown() throws', async () => {
      const error = new Error('shutdown failed');
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(error),
      });
      configure({ service });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow('shutdown failed');
      expect(isInitialized()).toBe(true);
    });

    it('should re-throw the error from service.shutdown()', async () => {
      const error = new Error('shutdown kaboom');
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(error),
      });
      configure({ service });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toBe(error);
    });

    it('should be a no-op after resetConfig clears both config and initialized state', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      resetConfig();
      
      
      await shutdownScheduledPublishing();
      expect(service.shutdown).not.toHaveBeenCalled();
    });

    it('should log "Shutting down cron job..." before calling service', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      expect(logger.log).toHaveBeenCalledWith(
        '[ScheduledPublishing] Shutting down cron job...'
      );
    });

    it('should log "Cron job stopped" after successful shutdown', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      expect(logger.log).toHaveBeenCalledWith(
        '[ScheduledPublishing] Cron job stopped'
      );
    });

    it('should log error when service.shutdown() throws', async () => {
      const error = new Error('shutdown error');
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(error),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        '[ScheduledPublishing] Error during shutdown:',
        error
      );
    });

    it('should not log "Cron job stopped" when service.shutdown() throws', async () => {
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow();
      expect(logger.log).not.toHaveBeenCalledWith(
        '[ScheduledPublishing] Cron job stopped'
      );
    });

    it('should not log anything when shutdown is called while not initialized', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      
      logger.log.mockClear();
      logger.error.mockClear();
      await shutdownScheduledPublishing();
      
      expect(logger.log).not.toHaveBeenCalledWith(
        '[ScheduledPublishing] Shutting down cron job...'
      );
      expect(logger.log).not.toHaveBeenCalledWith(
        '[ScheduledPublishing] Cron job stopped'
      );
    });

    it('should return void on successful shutdown', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      const result = await shutdownScheduledPublishing();
      expect(result).toBeUndefined();
    });

    it('should return void when shutdown is a no-op', async () => {
      const service = createMockService();
      configure({ service });
      const result = await shutdownScheduledPublishing();
      expect(result).toBeUndefined();
    });

    it('should allow retry after a failed shutdown', async () => {
      let callCount = 0;
      const service = createMockService({
        shutdown: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('transient shutdown failure');
        }),
      });
      configure({ service });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow('transient shutdown failure');
      expect(isInitialized()).toBe(true);
      await shutdownScheduledPublishing();
      expect(isInitialized()).toBe(false);
    });
  });

  
  
  
  describe('Full lifecycle', () => {
    it('should support init -> shutdown -> re-init', async () => {
      const service = createMockService();
      configure({ service });

      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);

      await shutdownScheduledPublishing();
      expect(isInitialized()).toBe(false);

      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);
      expect(service.initialize).toHaveBeenCalledTimes(2);
    });

    it('should support init -> shutdown -> re-init -> shutdown', async () => {
      const service = createMockService();
      configure({ service });

      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();

      expect(service.initialize).toHaveBeenCalledTimes(2);
      expect(service.shutdown).toHaveBeenCalledTimes(2);
      expect(isInitialized()).toBe(false);
    });

    it('should handle double init gracefully', async () => {
      const service = createMockService();
      configure({ service });

      await initializeScheduledPublishing();
      await initializeScheduledPublishing();

      expect(service.initialize).toHaveBeenCalledTimes(1);
      expect(isInitialized()).toBe(true);
    });

    it('should handle double shutdown gracefully', async () => {
      const service = createMockService();
      configure({ service });

      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      await shutdownScheduledPublishing();

      expect(service.shutdown).toHaveBeenCalledTimes(1);
      expect(isInitialized()).toBe(false);
    });

    it('should handle init -> failed shutdown -> successful shutdown', async () => {
      let shutdownCallCount = 0;
      const service = createMockService({
        shutdown: vi.fn().mockImplementation(async () => {
          shutdownCallCount++;
          if (shutdownCallCount === 1) throw new Error('first shutdown fails');
        }),
      });
      configure({ service });

      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow('first shutdown fails');
      expect(isInitialized()).toBe(true);

      await shutdownScheduledPublishing();
      expect(isInitialized()).toBe(false);
    });

    it('should handle failed init -> successful init -> shutdown', async () => {
      let initCallCount = 0;
      const service = createMockService({
        initialize: vi.fn().mockImplementation(async () => {
          initCallCount++;
          if (initCallCount === 1) throw new Error('first init fails');
        }),
      });
      configure({ service });

      await expect(initializeScheduledPublishing()).rejects.toThrow('first init fails');
      expect(isInitialized()).toBe(false);

      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);

      await shutdownScheduledPublishing();
      expect(isInitialized()).toBe(false);
    });

    it('should track correct call counts through multiple cycles', async () => {
      const service = createMockService();
      configure({ service });

      for (let i = 0; i < 5; i++) {
        await initializeScheduledPublishing();
        await shutdownScheduledPublishing();
      }

      expect(service.initialize).toHaveBeenCalledTimes(5);
      expect(service.shutdown).toHaveBeenCalledTimes(5);
    });

    it('should log correct sequence through init -> shutdown cycle', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });

      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();

      const logCalls = logger.log.mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls).toEqual([
        '[ScheduledPublishing] Initializing cron job...',
        '[ScheduledPublishing] Cron job initialized successfully',
        '[ScheduledPublishing] Shutting down cron job...',
        '[ScheduledPublishing] Cron job stopped',
      ]);
    });

    it('should produce no error logs through a clean lifecycle', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });

      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  
  
  
  describe('Logger integration', () => {
    it('should use custom logger when provided', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      expect(logger.log).toHaveBeenCalled();
    });

    it('should use default logger (console) when no logger configured', async () => {
      const service = createMockService();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      configure({ service });
      await initializeScheduledPublishing();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ScheduledPublishing] Initializing cron job...'
      );
      consoleSpy.mockRestore();
    });

    it('should use default console.error when no logger configured and init fails', async () => {
      const error = new Error('init boom');
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(error),
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      configure({ service });
      await expect(initializeScheduledPublishing()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ScheduledPublishing] Failed to initialize cron job:',
        error
      );
      consoleErrorSpy.mockRestore();
    });

    it('should use default console.error when no logger configured and shutdown fails', async () => {
      const error = new Error('shutdown boom');
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(error),
      });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      configure({ service });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ScheduledPublishing] Error during shutdown:',
        error
      );
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should not call custom logger for shutdown no-op', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await shutdownScheduledPublishing();
      
      expect(logger.log).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should pass error object to logger.error on init failure', async () => {
      const error = new Error('specific error');
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue(error),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await expect(initializeScheduledPublishing()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][1]).toBe(error);
    });

    it('should pass error object to logger.error on shutdown failure', async () => {
      const error = new Error('shutdown specific error');
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue(error),
      });
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][1]).toBe(error);
    });

    it('should call logger.log exactly twice for a successful init', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      expect(logger.log).toHaveBeenCalledTimes(2);
    });

    it('should call logger.log exactly twice for a successful shutdown', async () => {
      const service = createMockService();
      const logger = createMockLogger();
      configure({ service, logger });
      await initializeScheduledPublishing();
      logger.log.mockClear();
      await shutdownScheduledPublishing();
      expect(logger.log).toHaveBeenCalledTimes(2);
    });

    it('should switch loggers when reconfigured between calls', async () => {
      const service = createMockService();
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();

      configure({ service, logger: logger1 });
      await initializeScheduledPublishing();
      expect(logger1.log).toHaveBeenCalled();
      expect(logger2.log).not.toHaveBeenCalled();

      configure({ service, logger: logger2 });
      await shutdownScheduledPublishing();
      expect(logger2.log).toHaveBeenCalled();
    });
  });

  
  
  
  describe('Edge cases', () => {
    it('should allow configure() after init without affecting initialized state', async () => {
      const service1 = createMockService();
      const service2 = createMockService();
      configure({ service: service1 });
      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);

      configure({ service: service2 });
      expect(isInitialized()).toBe(true);
      expect(getCurrentConfig()!.service).toBe(service2);
    });

    it('should use new service after reconfigure for shutdown', async () => {
      const service1 = createMockService();
      const service2 = createMockService();
      configure({ service: service1 });
      await initializeScheduledPublishing();

      configure({ service: service2 });
      await shutdownScheduledPublishing();

      expect(service1.shutdown).not.toHaveBeenCalled();
      expect(service2.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should resetConfig clearing initialized state prevents shutdown call', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      expect(isInitialized()).toBe(true);

      resetConfig();
      expect(isInitialized()).toBe(false);
      expect(getCurrentConfig()).toBeNull();
    });

    it('should handle service that resolves with a value (ignored)', async () => {
      const service = {
        initialize: vi.fn().mockResolvedValue('some-value'),
        shutdown: vi.fn().mockResolvedValue(42),
      };
      configure({ service });
      const initResult = await initializeScheduledPublishing();
      const shutdownResult = await shutdownScheduledPublishing();
      expect(initResult).toBeUndefined();
      expect(shutdownResult).toBeUndefined();
    });

    it('should handle non-Error throws from service.initialize()', async () => {
      const service = createMockService({
        initialize: vi.fn().mockRejectedValue('string error'),
      });
      configure({ service });
      await expect(initializeScheduledPublishing()).rejects.toBe('string error');
    });

    it('should handle non-Error throws from service.shutdown()', async () => {
      const service = createMockService({
        shutdown: vi.fn().mockRejectedValue({ code: 'ERR_SHUTDOWN' }),
      });
      configure({ service });
      await initializeScheduledPublishing();
      await expect(shutdownScheduledPublishing()).rejects.toEqual({ code: 'ERR_SHUTDOWN' });
    });

    it('should handle configure() called multiple times before any init', () => {
      const service1 = createMockService();
      const service2 = createMockService();
      const service3 = createMockService();
      configure({ service: service1 });
      configure({ service: service2 });
      configure({ service: service3 });
      expect(getCurrentConfig()!.service).toBe(service3);
      expect(isInitialized()).toBe(false);
    });

    it('should throw from initializeScheduledPublishing when config cleared mid-lifecycle', async () => {
      const service = createMockService();
      configure({ service });
      await initializeScheduledPublishing();
      await shutdownScheduledPublishing();
      resetConfig();
      await expect(initializeScheduledPublishing()).rejects.toThrow(
        '[ScheduledPublishing] Not configured'
      );
    });
  });
});
