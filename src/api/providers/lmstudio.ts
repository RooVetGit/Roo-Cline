import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ApiHandler } from "../"
import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { withRetry } from "../utils/retry"

export class LmStudioHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			baseURL: (this.options.lmStudioBaseUrl || "http://localhost:1234") + "/v1",
			apiKey: "noop",
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const self = this;
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const gen = withRetry(async () => {
			const stream = await self.client.chat.completions.create({
				model: self.getModel().id,
				messages: openAiMessages,
				temperature: 0,
				stream: true,
			}).catch(error => {
				// LM Studio doesn't return an error code/body for now
				throw new Error(
					"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Cline's prompts.",
				)
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
				}
			})();
		}, {
			maxRetries: 10,
			initialDelayMs: 2000,
			onRetry: (error, attempt, delayMs) => {
				console.log(`LM Studio request failed (attempt ${attempt})`);
				console.log(`Error:`, error);
				console.log(`Retrying in ${delayMs}ms...`);
			}
		});

		for await (const chunk of gen) {
			yield chunk;
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.lmStudioModelId || "",
			info: openAiModelInfoSaneDefaults,
		}
	}
}
