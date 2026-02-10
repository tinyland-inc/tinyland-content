/**
 * Content Service Configuration
 *
 * Provides config injection to replace all `$lib/` and `$env/` imports
 * from the monorepo with a framework-agnostic configuration pattern.
 *
 * @module config
 */

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Logger interface compatible with any structured logging library.
 * Consumers inject their own logger implementation.
 */
export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
}

// ============================================================================
// Tracer Interface
// ============================================================================

/**
 * Minimal tracer/span interface compatible with OpenTelemetry.
 * Consumers inject their own tracer implementation.
 */
export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  recordException(error: Error): void;
  end(): void;
}

export interface Tracer {
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
}

// ============================================================================
// Content Service Config
// ============================================================================

/**
 * Configuration for content services.
 * Replaces all `$lib/` and `$env/` monorepo imports with explicit config injection.
 */
export interface ContentServiceConfig {
  /** Base directory for content files (e.g., './src/content') */
  contentDir: string;
  /** Directory for version history, schedules, etc. (e.g., './data') */
  dataDir?: string;
  /** Optional structured logger */
  logger?: Logger;
  /** Optional OpenTelemetry tracer */
  tracer?: Tracer;
}

// ============================================================================
// Config State
// ============================================================================

let _config: ContentServiceConfig | null = null;

/**
 * Configure the content services.
 * Call once at application startup before using any content services.
 *
 * @param config - Content service configuration
 *
 * @example
 * ```typescript
 * import { configureContent } from '@tinyland-inc/tinyland-content';
 *
 * configureContent({
 *   contentDir: './src/content',
 *   dataDir: './data',
 *   logger: myStructuredLogger,
 *   tracer: myOtelTracer,
 * });
 * ```
 */
export function configureContent(config: ContentServiceConfig): void {
  _config = config;
}

/**
 * Get the current content service configuration.
 * Returns sensible defaults if not explicitly configured.
 *
 * @returns The current content service configuration
 */
export function getContentConfig(): ContentServiceConfig {
  if (!_config) {
    return {
      contentDir: './src/content',
      dataDir: './data',
    };
  }
  return _config;
}

/**
 * Reset the content configuration (primarily for testing).
 */
export function resetContentConfig(): void {
  _config = null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** No-op logger for when no logger is configured */
const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * Get the configured logger, falling back to a console logger.
 */
export function getLogger(): Logger {
  return _config?.logger ?? noopLogger;
}

/**
 * Get the configured tracer, or undefined if not configured.
 */
export function getTracer(): Tracer | undefined {
  return _config?.tracer;
}

/**
 * Execute a function within an optional OTel span.
 * If no tracer is configured, the function runs without tracing.
 *
 * @param name - Span name
 * @param fn - Function to execute
 * @returns The function's return value
 */
export function withSpan<T>(name: string, fn: (span?: Span) => T): T {
  const tracer = getTracer();
  if (tracer) {
    return tracer.startActiveSpan(name, (span) => {
      try {
        const result = fn(span);
        // Handle promises
        if (result instanceof Promise) {
          return result
            .then((val) => {
              span.setStatus({ code: 1 }); // OK
              span.end();
              return val;
            })
            .catch((err) => {
              span.recordException(err);
              span.setStatus({ code: 2, message: err.message });
              span.end();
              throw err;
            }) as T;
        }
        span.setStatus({ code: 1 }); // OK
        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        span.end();
        throw error;
      }
    });
  }
  return fn(undefined);
}
