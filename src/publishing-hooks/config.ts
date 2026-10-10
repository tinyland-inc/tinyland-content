




























export interface PublishingHooksLogger {
	info: (msg: string, meta?: Record<string, unknown>) => void;
	warn: (msg: string, meta?: Record<string, unknown>) => void;
	error: (msg: string, meta?: Record<string, unknown>) => void;
	debug: (msg: string, meta?: Record<string, unknown>) => void;
}




export interface PublishingHooksSpan {
	setAttribute: (key: string, value: string | number | boolean) => void;
	setStatus: (status: { code: number }) => void;
	recordException: (error: Error) => void;
	end: () => void;
}




export interface PublishingHooksTracer {
	startActiveSpan: <T>(name: string, fn: (span: PublishingHooksSpan) => Promise<T>) => Promise<T>;
}




export interface ScheduledPublishingServiceInterface {
	scheduleContent: (
		contentType: string,
		slug: string,
		scheduledAt: string,
		timezone: string,
		autoFederate: boolean,
		userHandle: string
	) => Promise<void>;
	cancelSchedule: (contentType: string, slug: string) => Promise<void>;
}




export interface VersionHistoryServiceInterface {
	saveVersion: (
		contentType: string,
		slug: string,
		frontmatter: Record<string, unknown>,
		content: string,
		changeType: string,
		userHandle: string,
		changeSummary?: string
	) => Promise<{ version: number; id: string }>;
}




export interface ContentFederationInterface {
	wrapInCreateActivity: (content: unknown, baseUrl: string) => { id: string; type: string };
	wrapInUpdateActivity: (content: unknown, baseUrl: string) => { id: string; type: string };
	createDeleteActivity: (content: unknown, baseUrl: string) => { id: string; type: string };
	shouldFederateContent: (content: unknown) => boolean;
}




export type CreateSpanFn = (
	name: string,
	fn: (span: PublishingHooksSpan) => Promise<void>,
	options?: { kind?: number }
) => Promise<void>;




export interface PublishingHooksConfig {
	
	getTracer?: () => PublishingHooksTracer;

	
	createSpan?: CreateSpanFn;

	
	SpanStatusCode?: { OK: number; ERROR: number };

	
	SpanKindINTERNAL?: number;

	
	getLogger?: (scope?: { component: string }) => PublishingHooksLogger;

	
	scheduledPublishingService?: ScheduledPublishingServiceInterface;

	
	versionHistoryService?: VersionHistoryServiceInterface;

	
	contentFederation?: ContentFederationInterface;

	
	baseUrl?: string;
}






const noopLogger: PublishingHooksLogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {},
};


const noopSpan: PublishingHooksSpan = {
	setAttribute: () => {},
	setStatus: () => {},
	recordException: () => {},
	end: () => {},
};


const noopTracer: PublishingHooksTracer = {
	startActiveSpan: async <T>(
		_name: string,
		fn: (span: PublishingHooksSpan) => Promise<T>
	): Promise<T> => {
		return fn(noopSpan);
	},
};


const noopCreateSpan: CreateSpanFn = async (
	_name: string,
	fn: (span: PublishingHooksSpan) => Promise<void>,
	_options?: { kind?: number }
): Promise<void> => {
	return fn(noopSpan);
};


const noopScheduledPublishingService: ScheduledPublishingServiceInterface = {
	scheduleContent: async () => {},
	cancelSchedule: async () => {},
};


const noopVersionHistoryService: VersionHistoryServiceInterface = {
	saveVersion: async () => ({ version: 0, id: 'noop' }),
};


const noopContentFederation: ContentFederationInterface = {
	wrapInCreateActivity: (_content, _baseUrl) => ({ id: 'noop', type: 'Create' }),
	wrapInUpdateActivity: (_content, _baseUrl) => ({ id: 'noop', type: 'Update' }),
	createDeleteActivity: (_content, _baseUrl) => ({ id: 'noop', type: 'Delete' }),
	shouldFederateContent: () => false,
};





let config: PublishingHooksConfig = {};


















export function configurePublishingHooks(c: PublishingHooksConfig): void {
	config = { ...config, ...c };
}






export function getPublishingHooksConfig(): Required<PublishingHooksConfig> {
	return {
		getTracer: config.getTracer ?? (() => noopTracer),
		createSpan: config.createSpan ?? noopCreateSpan,
		SpanStatusCode: config.SpanStatusCode ?? { OK: 0, ERROR: 2 },
		SpanKindINTERNAL: config.SpanKindINTERNAL ?? 0,
		getLogger: config.getLogger ?? (() => noopLogger),
		scheduledPublishingService:
			config.scheduledPublishingService ?? noopScheduledPublishingService,
		versionHistoryService: config.versionHistoryService ?? noopVersionHistoryService,
		contentFederation: config.contentFederation ?? noopContentFederation,
		baseUrl: config.baseUrl ?? 'http://localhost:5174',
	};
}





export function resetPublishingHooksConfig(): void {
	config = {};
}
