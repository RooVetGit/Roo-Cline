import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ApiHandler } from "../"
import {
	ApiHandlerOptions,
	ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
} from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { withRetry } from "../utils/retry"

export class OpenAiNativeHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			apiKey: this.options.openAiNativeApiKey,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const self = this;

		switch (this.getModel().id) {
			case "o1-preview":
			case "o1-mini": {
				const gen = withRetry(async () => {
					// o1 doesnt support streaming, non-1 temp, or system prompt
					const response = await self.client.chat.completions.create({
						model: self.getModel().id,
						messages: [{ role: "user", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
					});

					return (async function*() {
						yield {
							type: "text",
							text: response.choices[0]?.message.content || "",
						} as ApiStreamChunk;
						yield {
							type: "usage",
							inputTokens: response.usage?.prompt_tokens || 0,
							outputTokens: response.usage?.completion_tokens || 0,
						} as ApiStreamChunk;
					})();
				}, {
					maxRetries: 10,
					initialDelayMs: 2000,
					onRetry: (error, attempt, delayMs) => {
						console.log(`OpenAI Native request failed (attempt ${attempt})`);
						console.log(`Error:`, error);
						console.log(`Retrying in ${delayMs}ms...`);
					}
				});

				for await (const chunk of gen) {
					yield chunk;
				}
				break;
			}
			default: {
				const gen = withRetry(async () => {
					const stream = await self.client.chat.completions.create({
						model: self.getModel().id,
						// max_completion_tokens: this.getModel().info.maxTokens,
						temperature: 0,
						messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
						stream: true,
						stream_options: { include_usage: true },
					});

					return (async function*() {
						for await (const chunk of stream) {
							const delta = chunk.choices[0]?.delta
							if (delta?.content) {
								yield {
									type: "text",
									text: delta.content,
								} as ApiStreamChunk;
							}

							// contains a null value except for the last chunk which contains the token usage statistics for the entire request
							if (chunk.usage) {
								yield {
									type: "usage",
									inputTokens: chunk.usage.prompt_tokens || 0,
									outputTokens: chunk.usage.completion_tokens || 0,
								} as ApiStreamChunk;
							}
						}
					})();
				}, {
					maxRetries: 10,
					initialDelayMs: 2000,
					onRetry: (error, attempt, delayMs) => {
						console.log(`OpenAI Native request failed (attempt ${attempt})`);
						console.log(`Error:`, error);
						console.log(`Retrying in ${delayMs}ms...`);
					}
				});

				for await (const chunk of gen) {
					yield chunk;
				}
			}
		}
	}

	getModel(): { id: OpenAiNativeModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in openAiNativeModels) {
			const id = modelId as OpenAiNativeModelId
			return { id, info: openAiNativeModels[id] }
		}
		return { id: openAiNativeDefaultModelId, info: openAiNativeModels[openAiNativeDefaultModelId] }
	}
}
