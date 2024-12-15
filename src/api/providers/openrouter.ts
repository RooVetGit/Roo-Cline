import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import OpenAI from "openai"
import { ApiHandler } from "../"
import { ApiHandlerOptions, ModelInfo, openRouterDefaultModelId, openRouterDefaultModelInfo } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStreamChunk, ApiStreamUsageChunk } from "../transform/stream"
import delay from "delay"
import { withRetry } from "../utils/retry"

// Add custom interface for OpenRouter params
interface OpenRouterChatCompletionParams extends OpenAI.Chat.ChatCompletionCreateParamsStreaming {
    transforms?: string[];
}

// Add custom interface for OpenRouter usage chunk
interface OpenRouterApiStreamUsageChunk extends ApiStreamUsageChunk {
    fullResponseText: string;
}

export class OpenRouterHandler implements ApiHandler {
	private static requestCount = 0
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			baseURL: "https://openrouter.ai/api/v1",
			apiKey: this.options.openRouterApiKey,
			defaultHeaders: {
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
				"X-Title": "Roo-Cline",
			},
		})
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.openRouterModelId
		const modelInfo = this.options.openRouterModelInfo
		if (modelId && modelInfo) {
			return { id: modelId, info: modelInfo }
		}
		return { id: openRouterDefaultModelId, info: openRouterDefaultModelInfo }
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): AsyncGenerator<ApiStreamChunk> {
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// prompt caching: https://openrouter.ai/docs/prompt-caching
		switch (this.getModel().id) {
			case "anthropic/claude-3.5-sonnet":
			case "anthropic/claude-3.5-sonnet:beta":
			case "anthropic/claude-3.5-sonnet-20240620":
			case "anthropic/claude-3.5-sonnet-20240620:beta":
			case "anthropic/claude-3-5-haiku":
			case "anthropic/claude-3-5-haiku:beta":
			case "anthropic/claude-3-5-haiku-20241022":
			case "anthropic/claude-3-5-haiku-20241022:beta":
			case "anthropic/claude-3-haiku":
			case "anthropic/claude-3-haiku:beta":
			case "anthropic/claude-3-opus":
			case "anthropic/claude-3-opus:beta":
				openAiMessages[0] = {
					role: "system",
					content: [
						{
							type: "text",
							text: systemPrompt,
							// @ts-ignore-next-line
							cache_control: { type: "ephemeral" },
						},
					],
				}
				const lastTwoUserMessages = openAiMessages.filter((msg) => msg.role === "user").slice(-2)
				lastTwoUserMessages.forEach((msg) => {
					if (typeof msg.content === "string") {
						msg.content = [{ type: "text", text: msg.content }]
					}
					if (Array.isArray(msg.content)) {
						let lastTextPart = msg.content.filter((part) => part.type === "text").pop()
						if (!lastTextPart) {
							lastTextPart = { type: "text", text: "..." }
							msg.content.push(lastTextPart)
						}
						// @ts-ignore-next-line
						lastTextPart["cache_control"] = { type: "ephemeral" }
					}
				})
				break
		}

		let maxTokens: number | undefined
		switch (this.getModel().id) {
			case "anthropic/claude-3.5-sonnet":
			case "anthropic/claude-3.5-sonnet:beta":
			case "anthropic/claude-3.5-sonnet-20240620":
			case "anthropic/claude-3.5-sonnet-20240620:beta":
			case "anthropic/claude-3-5-haiku":
			case "anthropic/claude-3-5-haiku:beta":
			case "anthropic/claude-3-5-haiku-20241022":
			case "anthropic/claude-3-5-haiku-20241022:beta":
				maxTokens = 8_192
				break
		}

		let fullResponseText = "";
		const self = this;

		const gen = withRetry(async () => {
			const stream = await self.client.chat.completions.create({
				model: self.getModel().id,
				max_tokens: maxTokens,
				temperature: 0,
				messages: openAiMessages,
				stream: true,
				...(self.options.openRouterUseMiddleOutTransform && { transforms: ["middle-out"] })
			} as OpenRouterChatCompletionParams);

			let genId: string | undefined;

			return (async function*() {
				for await (const chunk of stream) {
					if ("error" in chunk) {
						const error = chunk.error as { message?: string; code?: number }
						console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
						throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
					}

					if (!genId && chunk.id) {
						genId = chunk.id
					}

					const delta = chunk.choices[0]?.delta
					if (delta?.content) {
						fullResponseText += delta.content;
						yield {
							type: "text",
							text: delta.content,
						} as ApiStreamChunk;
					}
				}

				await delay(500)

				try {
					const response = await axios.get(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
						headers: {
							Authorization: `Bearer ${self.options.openRouterApiKey}`,
						},
						timeout: 5_000,
					})

					const generation = response.data?.data
					console.log("OpenRouter generation details:", response.data)
					yield {
						type: "usage",
						inputTokens: generation?.native_tokens_prompt || 0,
						outputTokens: generation?.native_tokens_completion || 0,
						totalCost: generation?.total_cost || 0,
						fullResponseText
					} as ApiStreamChunk;
				} catch (error) {
					console.error("Error fetching OpenRouter generation details:", error)
				}

				// Add newlines before starting content
				yield {
					type: "text",
					text: "\n\n"
				} as ApiStreamChunk;
			})();
		}, {
			maxRetries: 10,
			initialDelayMs: 2000,
			onRetry: (error, attempt, delayMs) => {
				console.log(`OpenRouter request failed (attempt ${attempt})`);
				console.log(`Error:`, error);
				console.log(`Retrying in ${delayMs}ms...`);
			}
		});

		for await (const chunk of gen) {
			yield chunk;
		}
	}
}
