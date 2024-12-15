export type ApiStream = AsyncGenerator<ApiStreamChunk>
export type ApiStreamChunk = ApiStreamTextChunk | ApiStreamUsageChunk | ApiStreamStatusChunk

export interface ApiStreamTextChunk {
	type: "text"
	text: string
}

export interface ApiStreamUsageChunk {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
	totalCost?: number // openrouter
}

export interface ApiStreamStatusChunk {
	type: "status"
	text: string
}
