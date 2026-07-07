
















export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
}









export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  recordException(error: Error): void;
  end(): void;
}

export interface Tracer {
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
}









export interface ContentServiceConfig {

  contentDir: string;

  /**
   * Optional read-through baseline directory for user content, mirroring
   * `contentDir`'s `users/<handle>/<type>` layout. When set, loaders overlay
   * bundled-then-live so live (contentDir) authored files win per handle/slug.
   * Used to back apex /blog, /@handle/blog and /feed surfaces when the live
   * content directory is an empty PVC mount (TIN-1952). Undefined = today's
   * behavior (live dir only).
   */
  bundledContentDir?: string;

  dataDir?: string;

  logger?: Logger;

  tracer?: Tracer;
}





let _config: ContentServiceConfig | null = null;



















export function configureContent(config: ContentServiceConfig): void {
  _config = config;
}







export function getContentConfig(): ContentServiceConfig {
  if (!_config) {
    return {
      // TIN-1931: the real content root is ./content (content/users/<handle>/…),
      // matching what hooks.server.ts configures at runtime. The legacy
      // ./src/content tree no longer holds user content.
      contentDir: './content',
      dataDir: './data',
    };
  }
  return _config;
}




export function resetContentConfig(): void {
  _config = null;
}






const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};




export function getLogger(): Logger {
  return _config?.logger ?? noopLogger;
}




export function getTracer(): Tracer | undefined {
  return _config?.tracer;
}









export function withSpan<T>(name: string, fn: (span?: Span) => T): T {
  const tracer = getTracer();
  if (tracer) {
    return tracer.startActiveSpan(name, (span) => {
      try {
        const result = fn(span);
        
        if (result instanceof Promise) {
          return result
            .then((val) => {
              span.setStatus({ code: 1 }); 
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
        span.setStatus({ code: 1 }); 
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
