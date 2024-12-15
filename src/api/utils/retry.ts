import delay from "delay"
import { ApiStreamChunk } from "../transform/stream"

export interface RetryOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export async function* withRetry(
	operation: () => Promise<AsyncGenerator<ApiStreamChunk>>,
	options: RetryOptions = {}
): AsyncGenerator<ApiStreamChunk> {
	const {
		maxRetries = 5,
		initialDelayMs = 2000,
		onRetry = (error, attempt, delayMs) => {
			console.log(`Operation failed, attempt ${attempt}/${maxRetries}`);
			console.log(`Error:`, error);
			console.log(`Retrying in ${delayMs}ms...`);
		},
	} = options;

	let attempt = 0;

	while (true) {
		try {
			const stream = await operation();
			for await (const chunk of stream) {
				yield chunk;
			}
			return;
		} catch (error) {
			attempt++;
			if (attempt > maxRetries) {
				console.log(`Max retries (${maxRetries}) exceeded, giving up`);
				throw error;
			}

			const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
			onRetry(error, attempt, delayMs);

			yield {
				type: "text",
				text: `Request failed. Retrying in ${delayMs/1000} seconds... (attempt ${attempt}/${maxRetries})\n\n`
			};

			await delay(delayMs);
		}
	}
}