









export type ContentType = 'blog' | 'event' | 'product' | 'program' | 'note' | 'profile' | 'video';

export interface UnifiedContentItem {
	type: ContentType;
	slug: string;
	title?: string;
	content: string;
	frontmatter: Record<string, unknown> | object;
	[key: string]: unknown;
}


export type PublishingStatus = 'draft' | 'pending' | 'scheduled' | 'published' | 'archived';
