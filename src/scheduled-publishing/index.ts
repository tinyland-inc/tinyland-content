/**
 * Scheduled publishing service with file-based persistence and polling.
 *
 * Stores scheduled items in data/scheduled-publishing.json.
 * Polls every 60s to check for items past their scheduled time.
 * On trigger, updates content frontmatter to published: true.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// --- Types ---

export interface ScheduledItem {
	contentType: string;
	slug: string;
	scheduledAt: string; // ISO 8601
	timezone: string;
	autoFederate: boolean;
	userHandle: string;
	createdAt: string;
}

export interface ScheduledPublishingData {
	items: ScheduledItem[];
	lastProcessed: string;
}

export interface ScheduledPublishingService {
	initialize: () => Promise<void>;
	shutdown: () => Promise<void>;
}

export interface ScheduledPublishingLogger {
	log: (msg: string) => void;
	error: (msg: string, error?: unknown) => void;
}

export interface ScheduledPublishingConfig {
	service: ScheduledPublishingService;
	logger?: ScheduledPublishingLogger;
}

// --- Default logger ---

const defaultLogger: ScheduledPublishingLogger = {
	log: (msg: string) => console.log(msg),
	error: (msg: string, error?: unknown) => console.error(msg, error),
};

// --- Config management ---

let config: ScheduledPublishingConfig | null = null;
let initialized = false;

function getConfig(): ScheduledPublishingConfig {
	if (!config) {
		throw new Error(
			'[ScheduledPublishing] Not configured. Call configure() before using lifecycle hooks.'
		);
	}
	return config;
}

function getLogger(): ScheduledPublishingLogger {
	return config?.logger ?? defaultLogger;
}

export function configure(newConfig: ScheduledPublishingConfig): void {
	if (!newConfig.service) {
		throw new Error('[ScheduledPublishing] configure() requires a service.');
	}
	config = newConfig;
}

export function getCurrentConfig(): ScheduledPublishingConfig | null {
	return config;
}

export function resetConfig(): void {
	config = null;
	initialized = false;
}

export function isInitialized(): boolean {
	return initialized;
}

export async function initializeScheduledPublishing(): Promise<void> {
	const cfg = getConfig();
	const logger = getLogger();

	if (initialized) {
		logger.log('[ScheduledPublishing] Already initialized, skipping');
		return;
	}

	try {
		logger.log('[ScheduledPublishing] Initializing cron job...');
		await cfg.service.initialize();
		initialized = true;
		logger.log('[ScheduledPublishing] Cron job initialized successfully');
	} catch (error) {
		logger.error('[ScheduledPublishing] Failed to initialize cron job:', error);
		throw error;
	}
}

export async function shutdownScheduledPublishing(): Promise<void> {
	if (!initialized) {
		return;
	}

	const cfg = getConfig();
	const logger = getLogger();

	try {
		logger.log('[ScheduledPublishing] Shutting down cron job...');
		await cfg.service.shutdown();
		initialized = false;
		logger.log('[ScheduledPublishing] Cron job stopped');
	} catch (error) {
		logger.error('[ScheduledPublishing] Error during shutdown:', error);
		throw error;
	}
}

// --- File-based scheduled publishing service implementation ---

const POLL_INTERVAL_MS = 60_000; // 1 minute

function getDataPath(): string {
	return join(process.cwd(), 'data', 'scheduled-publishing.json');
}

function loadData(): ScheduledPublishingData {
	const filePath = getDataPath();
	if (!existsSync(filePath)) {
		return { items: [], lastProcessed: new Date().toISOString() };
	}
	try {
		return JSON.parse(readFileSync(filePath, 'utf-8'));
	} catch {
		return { items: [], lastProcessed: new Date().toISOString() };
	}
}

function saveData(data: ScheduledPublishingData): void {
	const filePath = getDataPath();
	const dir = join(process.cwd(), 'data');
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Schedule a content item for future publishing.
 */
export async function scheduleContent(
	contentType: string,
	slug: string,
	scheduledAt: string,
	timezone: string,
	autoFederate: boolean,
	userHandle: string
): Promise<void> {
	const data = loadData();

	// Remove existing schedule for same content
	data.items = data.items.filter(
		(item) => !(item.contentType === contentType && item.slug === slug)
	);

	data.items.push({
		contentType,
		slug,
		scheduledAt,
		timezone,
		autoFederate,
		userHandle,
		createdAt: new Date().toISOString(),
	});

	saveData(data);
}

/**
 * Cancel a scheduled publish.
 */
export async function cancelSchedule(
	contentType: string,
	slug: string
): Promise<void> {
	const data = loadData();
	data.items = data.items.filter(
		(item) => !(item.contentType === contentType && item.slug === slug)
	);
	saveData(data);
}

/**
 * Process all items that are past their scheduled time.
 * Called by the polling loop.
 */
export async function processScheduledItems(
	onPublish?: (item: ScheduledItem) => Promise<void>
): Promise<ScheduledItem[]> {
	const data = loadData();
	const now = new Date();
	const published: ScheduledItem[] = [];

	const remaining: ScheduledItem[] = [];

	for (const item of data.items) {
		const scheduledTime = new Date(item.scheduledAt);
		if (scheduledTime <= now) {
			try {
				if (onPublish) {
					await onPublish(item);
				}
				published.push(item);
			} catch (error) {
				// Keep failed items for retry
				defaultLogger.error(`[ScheduledPublishing] Failed to publish ${item.contentType}/${item.slug}:`, error);
				remaining.push(item);
			}
		} else {
			remaining.push(item);
		}
	}

	data.items = remaining;
	data.lastProcessed = now.toISOString();
	saveData(data);

	return published;
}

/**
 * Create a ScheduledPublishingService that polls for due items.
 */
export function createFileBasedService(
	onPublish?: (item: ScheduledItem) => Promise<void>,
	logger?: ScheduledPublishingLogger
): ScheduledPublishingService {
	let timer: ReturnType<typeof setInterval> | null = null;
	const log = logger ?? defaultLogger;

	return {
		async initialize() {
			log.log('[ScheduledPublishing] Starting poll loop (60s interval)');
			// Process immediately on startup
			const published = await processScheduledItems(onPublish);
			if (published.length > 0) {
				log.log(`[ScheduledPublishing] Published ${published.length} scheduled items on startup`);
			}

			timer = setInterval(async () => {
				try {
					const items = await processScheduledItems(onPublish);
					if (items.length > 0) {
						log.log(`[ScheduledPublishing] Published ${items.length} scheduled items`);
					}
				} catch (error) {
					log.error('[ScheduledPublishing] Poll error:', error);
				}
			}, POLL_INTERVAL_MS);
		},

		async shutdown() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			log.log('[ScheduledPublishing] Stopped');
		},
	};
}
