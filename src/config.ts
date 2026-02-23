
















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
      contentDir: './src/content',
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
