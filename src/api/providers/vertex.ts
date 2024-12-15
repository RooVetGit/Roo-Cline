import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { ApiHandler } from "../"
import { ApiHandlerOptions, ModelInfo, vertexDefaultModelId, VertexModelId, vertexModels } from "../../shared/api"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { withRetry } from "../utils/retry"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class VertexHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: AnthropicVertex

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new AnthropicVertex({
			projectId: this.options.vertexProjectId,
			// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
			region: this.options.vertexRegion,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const self = this;

		const gen = withRetry(async () => {
			const stream = await self.client.messages.create({
				model: self.getModel().id,
				max_tokens: self.getModel().info.maxTokens || 8192,
				temperature: 0,
				system: systemPrompt,
				messages,
				stream: true,
			})

			return (async function*() {
				for await (const chunk of stream) {
					switch (chunk.type) {
						case "message_start":
							const usage = chunk.message.usage
							yield {
								type: "usage",
								inputTokens: usage.input_tokens || 0,
								outputTokens: usage.output_tokens || 0,
							} as ApiStreamChunk;
							break
						case "message_delta":
							yield {
								type: "usage",
								inputTokens: 0,
								outputTokens: chunk.usage.output_tokens || 0,
							} as ApiStreamChunk;
							break

						case "content_block_start":
							switch (chunk.content_block.type) {
								case "text":
									if (chunk.index > 0) {
										yield {
											type: "text",
											text: "\n",
										} as ApiStreamChunk;
									}
									yield {
										type: "text",
										text: chunk.content_block.text,
									} as ApiStreamChunk;
									break
							}
							break
						case "content_block_delta":
							switch (chunk.delta.type) {
								case "text_delta":
									yield {
										type: "text",
										text: chunk.delta.text,
									} as ApiStreamChunk;
									break
							}
							break
					}
				}
			})();
		}, {
			maxRetries: 10,
			initialDelayMs: 2000,
			onRetry: (error, attempt, delayMs) => {
				console.log(`Vertex request failed (attempt ${attempt})`);
				console.log(`Error:`, error);
				console.log(`Retrying in ${delayMs}ms...`);
			}
		});

		for await (const chunk of gen) {
			yield chunk;
		}
	}

	getModel(): { id: VertexModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in vertexModels) {
			const id = modelId as VertexModelId
			return { id, info: vertexModels[id] }
		}
		return { id: vertexDefaultModelId, info: vertexModels[vertexDefaultModelId] }
	}
}
