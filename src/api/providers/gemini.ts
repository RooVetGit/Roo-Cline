import { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { ApiHandler } from "../"
import { ApiHandlerOptions, geminiDefaultModelId, GeminiModelId, geminiModels, ModelInfo } from "../../shared/api"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { withRetry } from "../utils/retry"

export class GeminiHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: GoogleGenerativeAI

	constructor(options: ApiHandlerOptions) {
		if (!options.geminiApiKey) {
			throw new Error("API key is required for Google Gemini")
		}
		this.options = options
		this.client = new GoogleGenerativeAI(options.geminiApiKey)
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const self = this;
		const model = this.client.getGenerativeModel({
			model: this.getModel().id,
			systemInstruction: systemPrompt,
		})

		const gen = withRetry(async () => {
			const result = await model.generateContentStream({
				contents: messages.map(convertAnthropicMessageToGemini),
				generationConfig: {
					// maxOutputTokens: this.getModel().info.maxTokens,
					temperature: 0,
				},
			})

			return (async function*() {
				for await (const chunk of result.stream) {
					yield {
						type: "text",
						text: chunk.text(),
					} as ApiStreamChunk;
				}

				const response = await result.response
				yield {
					type: "usage",
					inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
					outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
				} as ApiStreamChunk;
			})();
		}, {
			maxRetries: 10,
			initialDelayMs: 2000,
			onRetry: (error, attempt, delayMs) => {
				console.log(`Gemini request failed (attempt ${attempt})`);
				console.log(`Error:`, error);
				console.log(`Retrying in ${delayMs}ms...`);
			}
		});

		for await (const chunk of gen) {
			yield chunk;
		}
	}

	getModel(): { id: GeminiModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId as GeminiModelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}
}
