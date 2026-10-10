























import { getPublishingHooksConfig } from './config.js';
import type { PublishingHooksSpan } from './config.js';
import { recordContentVersion } from './version-hook.js';
import type { UnifiedContentItem, ContentType, PublishingStatus } from './types.js';





export interface PublishingHookContext {
	contentType: ContentType;
	slug: string;
	previousStatus?: PublishingStatus;
	newStatus: PublishingStatus;
	userHandle: string;
	scheduledAt?: string;
	timezone?: string;
	autoFederate?: boolean;
	changeSummary?: string;
}

export interface PublishingHookResult {
	success: boolean;
	versionCreated: boolean;
	scheduled: boolean;
	federated: boolean;
	errors: string[];
}














export async function onPublishingChange(
	content: UnifiedContentItem,
	context: PublishingHookContext
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_change', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', context.contentType);
			span.setAttribute('content.slug', context.slug);
			span.setAttribute('status.previous', context.previousStatus || 'none');
			span.setAttribute('status.new', context.newStatus);
			span.setAttribute('user.handle', context.userHandle);

			logger.info('Processing publishing change', {
				contentType: context.contentType,
				slug: context.slug,
				previousStatus: context.previousStatus,
				newStatus: context.newStatus,
				userHandle: context.userHandle
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await recordContentVersion(
					context.contentType,
					context.slug,
					content.frontmatter as Record<string, unknown>,
					content.content,
					'status',
					context.userHandle,
					context.changeSummary ||
						`Status changed: ${context.previousStatus || 'none'} \u2192 ${context.newStatus}`
				);
				result.versionCreated = true;
				span.setAttribute('version.created', true);
			} catch (error) {
				logger.error('Failed to record version', {
					error: error instanceof Error ? error.message : String(error),
					contentType: context.contentType,
					slug: context.slug
				});
				result.errors.push('Failed to record version history');
				
			}

			
			if (context.newStatus === 'scheduled' && context.scheduledAt) {
				try {
					await cfg.scheduledPublishingService.scheduleContent(
						context.contentType,
						context.slug,
						context.scheduledAt,
						context.timezone || 'UTC',
						context.autoFederate || false,
						context.userHandle
					);
					result.scheduled = true;
					span.setAttribute('scheduled', true);
					span.setAttribute('scheduled_at', context.scheduledAt);

					logger.info('Content scheduled for publishing', {
						contentType: context.contentType,
						slug: context.slug,
						scheduledAt: context.scheduledAt,
						timezone: context.timezone
					});
				} catch (error) {
					logger.error('Failed to schedule content', {
						error: error instanceof Error ? error.message : String(error),
						contentType: context.contentType,
						slug: context.slug
					});
					result.errors.push('Failed to schedule publishing');
					result.success = false;
				}
			}

			
			if (context.newStatus === 'published') {
				try {
					
					await cfg.scheduledPublishingService.cancelSchedule(
						context.contentType,
						context.slug
					);

					
					if (context.autoFederate && cfg.contentFederation.shouldFederateContent(content)) {
						try {
							await federateContent(content, 'create');
							result.federated = true;
							span.setAttribute('federated', true);

							logger.info('Content federated to ActivityPub', {
								contentType: context.contentType,
								slug: context.slug
							});
						} catch (error) {
							logger.error('Failed to federate content', {
								error: error instanceof Error ? error.message : String(error),
								contentType: context.contentType,
								slug: context.slug
							});
							result.errors.push(
								'Failed to federate to ActivityPub (content is published locally)'
							);
							
						}
					}
				} catch (error) {
					logger.error('Failed to handle publishing', {
						error: error instanceof Error ? error.message : String(error),
						contentType: context.contentType,
						slug: context.slug
					});
					result.errors.push('Failed to handle publishing');
					result.success = false;
				}
			}

			
			if (
				context.previousStatus === 'scheduled' &&
				context.newStatus !== 'scheduled' &&
				context.newStatus !== 'published'
			) {
				try {
					await cfg.scheduledPublishingService.cancelSchedule(
						context.contentType,
						context.slug
					);
					logger.info('Scheduled publishing cancelled', {
						contentType: context.contentType,
						slug: context.slug
					});
				} catch (error) {
					logger.warn('Failed to cancel schedule', {
						error: error instanceof Error ? error.message : String(error),
						contentType: context.contentType,
						slug: context.slug
					});
					
				}
			}

			span.setAttribute('result.success', result.success);
			span.setAttribute('result.errors_count', result.errors.length);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			logger.info('Publishing change processed', {
				contentType: context.contentType,
				slug: context.slug,
				result: result as unknown as Record<string, unknown>
			});

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			logger.error('Publishing hook failed', {
				error: error instanceof Error ? error.message : String(error),
				context: context as unknown as Record<string, unknown>
			});
			throw error;
		} finally {
			span.end();
		}
	});
}















export async function onContentCreate(
	content: UnifiedContentItem,
	userHandle: string,
	autoFederate?: boolean
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_create', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('user.handle', userHandle);

			logger.info('Processing content creation', {
				contentType: content.type,
				slug: content.slug,
				userHandle
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await recordContentVersion(
					content.type,
					content.slug,
					content.frontmatter as Record<string, unknown>,
					content.content,
					'create',
					userHandle,
					'Initial version'
				);
				result.versionCreated = true;
				span.setAttribute('version.created', true);
			} catch (error) {
				logger.error('Failed to record initial version', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				result.errors.push('Failed to record initial version');
				
			}

			
			const fm = content.frontmatter as Record<string, unknown>;
			if (autoFederate && fm.status === 'published' && cfg.contentFederation.shouldFederateContent(content)) {
				try {
					await federateContent(content, 'create');
					result.federated = true;
					span.setAttribute('federated', true);

					logger.info('New content federated to ActivityPub', {
						contentType: content.type,
						slug: content.slug
					});
				} catch (error) {
					logger.error('Failed to federate new content', {
						error: error instanceof Error ? error.message : String(error),
						contentType: content.type,
						slug: content.slug
					});
					result.errors.push('Failed to federate to ActivityPub');
					
				}
			}

			span.setAttribute('result.success', result.success);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}











export async function onContentUpdate(
	content: UnifiedContentItem,
	userHandle: string,
	changeSummary?: string
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_update', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('user.handle', userHandle);

			logger.info('Processing content update', {
				contentType: content.type,
				slug: content.slug,
				userHandle,
				changeSummary
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await recordContentVersion(
					content.type,
					content.slug,
					content.frontmatter as Record<string, unknown>,
					content.content,
					'edit',
					userHandle,
					changeSummary || 'Content updated'
				);
				result.versionCreated = true;
				span.setAttribute('version.created', true);
			} catch (error) {
				logger.error('Failed to record edit version', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				result.errors.push('Failed to record version');
				
			}

			
			const fm = content.frontmatter as Record<string, unknown>;
			if (fm.status === 'published' && cfg.contentFederation.shouldFederateContent(content)) {
				try {
					await federateContent(content, 'update');
					result.federated = true;
					span.setAttribute('federated', true);

					logger.info('Content update federated to ActivityPub', {
						contentType: content.type,
						slug: content.slug
					});
				} catch (error) {
					logger.error('Failed to federate update', {
						error: error instanceof Error ? error.message : String(error),
						contentType: content.type,
						slug: content.slug
					});
					result.errors.push('Failed to federate update to ActivityPub');
					
				}
			}

			span.setAttribute('result.success', result.success);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}










export async function onContentDelete(
	content: UnifiedContentItem,
	userHandle: string
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_delete', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('user.handle', userHandle);

			logger.info('Processing content deletion', {
				contentType: content.type,
				slug: content.slug,
				userHandle
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await cfg.scheduledPublishingService.cancelSchedule(content.type, content.slug);
			} catch (error) {
				logger.warn('Failed to cancel schedule on delete', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				
			}

			
			const fm = content.frontmatter as Record<string, unknown>;
			if (fm.status === 'published' && cfg.contentFederation.shouldFederateContent(content)) {
				try {
					await federateContent(content, 'delete');
					result.federated = true;
					span.setAttribute('federated', true);

					logger.info('Content deletion federated to ActivityPub', {
						contentType: content.type,
						slug: content.slug
					});
				} catch (error) {
					logger.error('Failed to federate deletion', {
						error: error instanceof Error ? error.message : String(error),
						contentType: content.type,
						slug: content.slug
					});
					result.errors.push('Failed to federate deletion to ActivityPub');
					
				}
			}

			span.setAttribute('result.success', result.success);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}













export async function onContentSchedule(
	content: UnifiedContentItem,
	scheduledAt: string,
	timezone: string,
	userHandle: string,
	autoFederate?: boolean
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_schedule', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('user.handle', userHandle);
			span.setAttribute('scheduled_at', scheduledAt);
			span.setAttribute('timezone', timezone);

			logger.info('Processing content scheduling', {
				contentType: content.type,
				slug: content.slug,
				userHandle,
				scheduledAt,
				timezone,
				autoFederate
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await recordContentVersion(
					content.type,
					content.slug,
					content.frontmatter as Record<string, unknown>,
					content.content,
					'status',
					userHandle,
					`Scheduled for publishing at ${scheduledAt} (${timezone})`
				);
				result.versionCreated = true;
				span.setAttribute('version.created', true);
			} catch (error) {
				logger.error('Failed to record schedule version', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				result.errors.push('Failed to record version');
				
			}

			
			try {
				await cfg.scheduledPublishingService.scheduleContent(
					content.type,
					content.slug,
					scheduledAt,
					timezone,
					autoFederate || false,
					userHandle
				);
				result.scheduled = true;
				span.setAttribute('scheduled', true);

				logger.info('Content scheduled successfully', {
					contentType: content.type,
					slug: content.slug,
					scheduledAt,
					timezone
				});
			} catch (error) {
				logger.error('Failed to schedule content', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				result.errors.push('Failed to schedule publishing');
				result.success = false;
			}

			span.setAttribute('result.success', result.success);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}











export async function onContentPublish(
	content: UnifiedContentItem,
	userHandle: string,
	autoFederate?: boolean
): Promise<PublishingHookResult> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.on_publish', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('user.handle', userHandle);
			span.setAttribute('auto_federate', autoFederate || false);

			logger.info('Processing immediate publishing', {
				contentType: content.type,
				slug: content.slug,
				userHandle,
				autoFederate
			});

			const result: PublishingHookResult = {
				success: true,
				versionCreated: false,
				scheduled: false,
				federated: false,
				errors: []
			};

			
			try {
				await recordContentVersion(
					content.type,
					content.slug,
					content.frontmatter as Record<string, unknown>,
					content.content,
					'status',
					userHandle,
					'Published immediately'
				);
				result.versionCreated = true;
				span.setAttribute('version.created', true);
			} catch (error) {
				logger.error('Failed to record publish version', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				result.errors.push('Failed to record version');
				
			}

			
			try {
				await cfg.scheduledPublishingService.cancelSchedule(content.type, content.slug);
			} catch (error) {
				logger.warn('Failed to cancel schedule', {
					error: error instanceof Error ? error.message : String(error),
					contentType: content.type,
					slug: content.slug
				});
				
			}

			
			if (autoFederate && cfg.contentFederation.shouldFederateContent(content)) {
				try {
					await federateContent(content, 'create');
					result.federated = true;
					span.setAttribute('federated', true);

					logger.info('Published content federated to ActivityPub', {
						contentType: content.type,
						slug: content.slug
					});
				} catch (error) {
					logger.error('Failed to federate published content', {
						error: error instanceof Error ? error.message : String(error),
						contentType: content.type,
						slug: content.slug
					});
					result.errors.push(
						'Failed to federate to ActivityPub (content is published locally)'
					);
					
				}
			}

			span.setAttribute('result.success', result.success);
			span.setStatus({ code: cfg.SpanStatusCode.OK });

			return result;
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}














async function federateContent(
	content: UnifiedContentItem,
	activityType: 'create' | 'update' | 'delete'
): Promise<void> {
	const cfg = getPublishingHooksConfig();
	const tracer = cfg.getTracer();
	const logger = cfg.getLogger({ component: 'publishing-hook' });

	return tracer.startActiveSpan('publishing_hook.federate_content', async (span: PublishingHooksSpan) => {
		try {
			span.setAttribute('content.type', content.type);
			span.setAttribute('content.slug', content.slug);
			span.setAttribute('activity.type', activityType);

			const baseUrl = cfg.baseUrl;

			
			let activity: { id: string; type: string };
			switch (activityType) {
				case 'create':
					activity = cfg.contentFederation.wrapInCreateActivity(content, baseUrl);
					break;
				case 'update':
					activity = cfg.contentFederation.wrapInUpdateActivity(content, baseUrl);
					break;
				case 'delete':
					activity = cfg.contentFederation.createDeleteActivity(content, baseUrl);
					break;
			}

			span.setAttribute('activity.id', activity.id);

			logger.info('Activity created for federation', {
				activityType,
				activityId: activity.id,
				contentType: content.type,
				slug: content.slug
			});

			
			
			
			
			
			

			
			logger.debug('Would deliver activity to followers', {
				activityId: activity.id,
				activityType: activity.type,
				contentType: content.type,
				slug: content.slug
			});

			span.setAttribute('delivered', false); 
			span.setStatus({ code: cfg.SpanStatusCode.OK });
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: cfg.SpanStatusCode.ERROR });
			throw error;
		} finally {
			span.end();
		}
	});
}
