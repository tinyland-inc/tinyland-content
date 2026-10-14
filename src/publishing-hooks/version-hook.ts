
























import { getPublishingHooksConfig } from './config.js';















export async function recordContentVersion(
	contentType: string,
	slug: string,
	frontmatter: Record<string, unknown>,
	content: string,
	changeType: 'create' | 'edit' | 'status' | 'restore' | 'auto',
	userHandle: string,
	changeSummary?: string
): Promise<void> {
	const cfg = getPublishingHooksConfig();
	const logger = cfg.getLogger({ component: 'version-hook' });

	return cfg.createSpan(
		'version_hook.record',
		async (span) => {
			span.setAttribute('content.type', contentType);
			span.setAttribute('content.slug', slug);
			span.setAttribute('change.type', changeType);
			span.setAttribute('user.handle', userHandle);

			logger.info('Recording content version', {
				contentType,
				slug,
				changeType,
				userHandle,
				changeSummary
			});

			try {
				const version = await cfg.versionHistoryService.saveVersion(
					contentType,
					slug,
					frontmatter,
					content,
					changeType,
					userHandle,
					changeSummary
				);

				span.setAttribute('version.number', version.version);
				span.setAttribute('version.id', version.id);

				logger.info('Version recorded successfully', {
					contentType,
					slug,
					versionNumber: version.version,
					versionId: version.id
				});
			} catch (error) {
				logger.error('Failed to record version', {
					error: error instanceof Error ? error.message : String(error),
					contentType,
					slug,
					changeType
				});
				
				span.recordException(error as Error);
			}
		},
		{ kind: cfg.SpanKindINTERNAL }
	);
}










export async function recordAutoVersion(
	contentType: string,
	slug: string,
	frontmatter: Record<string, unknown>,
	content: string,
	changeSummary: string
): Promise<void> {
	return recordContentVersion(
		contentType,
		slug,
		frontmatter,
		content,
		'auto',
		'system',
		changeSummary
	);
}












export async function recordCreateVersion(
	contentType: string,
	slug: string,
	frontmatter: Record<string, unknown>,
	content: string,
	userHandle: string
): Promise<void> {
	return recordContentVersion(
		contentType,
		slug,
		frontmatter,
		content,
		'create',
		userHandle,
		'Initial version'
	);
}













export async function recordEditVersion(
	contentType: string,
	slug: string,
	frontmatter: Record<string, unknown>,
	content: string,
	userHandle: string,
	changeSummary?: string
): Promise<void> {
	return recordContentVersion(
		contentType,
		slug,
		frontmatter,
		content,
		'edit',
		userHandle,
		changeSummary
	);
}














export async function recordStatusChangeVersion(
	contentType: string,
	slug: string,
	frontmatter: Record<string, unknown>,
	content: string,
	userHandle: string,
	oldStatus: string,
	newStatus: string
): Promise<void> {
	return recordContentVersion(
		contentType,
		slug,
		frontmatter,
		content,
		'status',
		userHandle,
		`Status changed: ${oldStatus} \u2192 ${newStatus}`
	);
}
