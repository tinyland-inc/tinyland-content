









































export {
	configurePublishingHooks,
	getPublishingHooksConfig,
	resetPublishingHooksConfig,
} from './config.js';

export type {
	PublishingHooksConfig,
	PublishingHooksLogger,
	PublishingHooksSpan,
	PublishingHooksTracer,
	ScheduledPublishingServiceInterface,
	VersionHistoryServiceInterface,
	ContentFederationInterface,
	CreateSpanFn,
} from './config.js';


export type {
	ContentType,
	UnifiedContentItem,
	PublishingStatus,
} from './types.js';


export {
	onPublishingChange,
	onContentCreate,
	onContentUpdate,
	onContentDelete,
	onContentSchedule,
	onContentPublish,
} from './publishing-hook.js';

export type {
	PublishingHookContext,
	PublishingHookResult,
} from './publishing-hook.js';


export {
	recordContentVersion,
	recordAutoVersion,
	recordCreateVersion,
	recordEditVersion,
	recordStatusChangeVersion,
} from './version-hook.js';
