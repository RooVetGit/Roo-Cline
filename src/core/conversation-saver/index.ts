import * as fs from "fs/promises"
import * as path from "path"
import { ClineMessage } from "../../shared/ExtensionMessage"

export class ConversationSaver {
	private saveFolder: string
	private currentFilePath?: string

	constructor(
		saveFolder: string,
		private workspaceRoot?: string,
	) {
		this.saveFolder = workspaceRoot ? path.resolve(workspaceRoot, saveFolder) : saveFolder
	}

	private formatMessagesAsMarkdown(messages: ClineMessage[]): string {
		const lines: string[] = []
		lines.push(`# Conversation saved at ${new Date().toISOString()}\n`)

		for (const msg of messages) {
			const timestamp = new Date(msg.ts).toLocaleTimeString()

			if (msg.type === "say") {
				if (msg.say === "task") {
					lines.push(`## Task (${timestamp})`)
					if (msg.text) lines.push(msg.text)
				} else if (msg.say === "text") {
					lines.push(`### Assistant (${timestamp})`)
					if (msg.text) lines.push(msg.text)
				} else if (msg.say === "user_feedback") {
					lines.push(`### User Feedback (${timestamp})`)
					if (msg.text) lines.push(msg.text)
				} else if (msg.say === "error") {
					lines.push(`### Error (${timestamp})`)
					if (msg.text) lines.push(`\`\`\`\n${msg.text}\n\`\`\``)
				} else if (msg.say === "api_req_started") {
					try {
						const apiInfo = JSON.parse(msg.text || "{}")
						if (apiInfo.tokensIn || apiInfo.tokensOut || apiInfo.cost) {
							lines.push(`### API Usage (${timestamp})`)
							if (apiInfo.provider) lines.push(`- Provider: ${apiInfo.provider}`)
							if (apiInfo.model) lines.push(`- Model: ${apiInfo.model}`)
							if (apiInfo.tokensIn) lines.push(`- Input tokens: ${apiInfo.tokensIn}`)
							if (apiInfo.tokensOut) lines.push(`- Output tokens: ${apiInfo.tokensOut}`)
							if (apiInfo.cost) lines.push(`- Cost: $${apiInfo.cost.toFixed(6)}`)
						}
					} catch (e) {
						// Skip malformed JSON
					}
				}
			} else if (msg.type === "ask") {
				if (msg.ask === "followup") {
					lines.push(`### Question (${timestamp})`)
					if (msg.text) lines.push(msg.text)
				} else if (msg.ask === "command") {
					lines.push(`### Command (${timestamp})`)
					if (msg.text) lines.push(`\`\`\`bash\n${msg.text}\n\`\`\``)
				} else if (msg.ask === "command_output") {
					lines.push(`### Command Output (${timestamp})`)
					if (msg.text) lines.push(`\`\`\`\n${msg.text}\n\`\`\``)
				}
			}

			// Handle images if present
			if (msg.images && msg.images.length > 0) {
				lines.push("\n**Images:**")
				msg.images.forEach((img, i) => {
					lines.push(`![Image ${i + 1}](${img})`)
				})
			}

			lines.push("") // Add blank line between messages
		}

		return lines.join("\n")
	}

	/**
	 * Creates a new conversation file with the given messages
	 * @param messages The messages to save
	 * @returns The path to the created file
	 */
	async saveConversation(messages: ClineMessage[]): Promise<string> {
		try {
			console.log("Attempting to save conversation to folder:", this.saveFolder)

			// Create save folder if it doesn't exist
			await fs.mkdir(this.saveFolder, { recursive: true })
			console.log("Save folder created/verified")

			// Generate filename based on timestamp and first message
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
			const firstMessage = messages.find((m) => m.type === "say" && m.say === "task")
			const taskText = firstMessage?.text?.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "-") || "conversation"
			const filename = `${timestamp}-${taskText}.md`
			console.log("Generated filename:", filename)

			// Save to file
			this.currentFilePath = path.join(this.saveFolder, filename)
			console.log("Attempting to write to:", this.currentFilePath)

			const markdown = this.formatMessagesAsMarkdown(messages)
			await fs.writeFile(this.currentFilePath, markdown, "utf-8")
			console.log("Successfully wrote file")

			return this.currentFilePath
		} catch (error) {
			console.error("Error saving conversation:", error)
			console.error("Error details:", error instanceof Error ? error.message : String(error))
			console.error("Save folder was:", this.saveFolder)
			console.error("Current working directory:", process.cwd())
			throw new Error("Failed to save conversation")
		}
	}

	/**
	 * Updates an existing conversation file with new messages
	 * @param messages The updated messages to save
	 * @returns The path to the updated file
	 */
	async updateConversation(messages: ClineMessage[]): Promise<string> {
		console.log("Attempting to update conversation")

		if (!this.currentFilePath) {
			console.log("No current file path, creating new conversation file")
			return await this.saveConversation(messages)
		}

		try {
			console.log("Updating existing file at:", this.currentFilePath)
			const markdown = this.formatMessagesAsMarkdown(messages)
			await fs.writeFile(this.currentFilePath, markdown, "utf-8")
			console.log("Successfully updated conversation file")
			return this.currentFilePath
		} catch (error) {
			console.error("Error updating conversation:", error)
			console.error("Error details:", error instanceof Error ? error.message : String(error))
			console.error("Current file path was:", this.currentFilePath)
			console.error("Current working directory:", process.cwd())
			throw new Error("Failed to update conversation")
		}
	}

	/**
	 * Gets the current conversation file path
	 */
	getCurrentFilePath(): string | undefined {
		return this.currentFilePath
	}

	/**
	 * Updates the save folder path
	 * @param newPath The new save folder path
	 */
	updateSaveFolder(newPath: string) {
		this.saveFolder = this.workspaceRoot ? path.resolve(this.workspaceRoot, newPath) : newPath
		// Reset current file path since we're changing folders
		this.currentFilePath = undefined
	}
}
