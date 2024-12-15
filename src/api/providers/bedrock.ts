import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from "../"
import { ApiHandlerOptions, bedrockDefaultModelId, BedrockModelId, bedrockModels, ModelInfo } from "../../shared/api"
import { ApiStream, ApiStreamChunk } from "../transform/stream"
import { withRetry } from "../utils/retry"

// https://docs.anthropic.com/en/api/claude-on-amazon-bedrock
export class AwsBedrockHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: AnthropicBedrock

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new AnthropicBedrock({
			// Authenticate by either providing the keys below or use the default AWS credential providers, such as
			// using ~/.aws/credentials or the "AWS_SECRET_ACCESS_KEY" and "AWS_ACCESS_KEY_ID" environment variables.
			...(this.options.awsAccessKey ? { awsAccessKey: this.options.awsAccessKey } : {}),
			...(this.options.awsSecretKey ? { awsSecretKey: this.options.awsSecretKey } : {}),
			...(this.options.awsSessionToken ? { awsSessionToken: this.options.awsSessionToken } : {}),

			// awsRegion changes the aws region to which the request is made. By default, we read AWS_REGION,
			// and if that's not present, we default to us-east-1. Note that we do not read ~/.aws/config for the region.
			awsRegion: this.options.awsRegion,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const self = this;

		// cross region inference requires prefixing the model id with the region
		let modelId: string
		if (this.options.awsUseCrossRegionInference) {
			let regionPrefix = (this.options.awsRegion || "").slice(0, 3)
			switch (regionPrefix) {
				case "us-":
					modelId = `us.${this.getModel().id}`
					break
				case "eu-":
					modelId = `eu.${this.getModel().id}`
					break
				default:
					// cross region inference is not supported in this region, falling back to default model
					modelId = this.getModel().id
					break
			}
		} else {
			modelId = this.getModel().id
		}

		const gen = withRetry(async () => {
			const stream = await self.client.messages.create({
				model: modelId,
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
							// tells us cache reads/writes/input/output
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
				console.log(`Bedrock request failed (attempt ${attempt})`);
				console.log(`Error:`, error);
				console.log(`Retrying in ${delayMs}ms...`);
			}
		});

		for await (const chunk of gen) {
			yield chunk;
		}
	}

	getModel(): { id: BedrockModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in bedrockModels) {
			const id = modelId as BedrockModelId
			return { id, info: bedrockModels[id] }
		}
		return { id: bedrockDefaultModelId, info: bedrockModels[bedrockDefaultModelId] }
	}
}
