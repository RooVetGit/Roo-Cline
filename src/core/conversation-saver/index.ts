import * as fs from "fs/promises"
import * as path from "path"
import { ClineMessage } from "../../shared/ExtensionMessage"

export class ConversationSaver {
	private saveFolder: string
	private currentFilePath?: string

	constructor(saveFolder: string) {
		this.saveFolder = saveFolder
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
			const filename = `${timestamp}-${taskText}.json`
			console.log("Generated filename:", filename)

			// Save to file
			this.currentFilePath = path.join(this.saveFolder, filename)
			console.log("Attempting to write to:", this.currentFilePath)

			await fs.writeFile(
				this.currentFilePath,
				JSON.stringify({ messages, lastUpdated: new Date().toISOString() }, null, 2),
				"utf-8",
			)
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
			await fs.writeFile(
				this.currentFilePath,
				JSON.stringify({ messages, lastUpdated: new Date().toISOString() }, null, 2),
				"utf-8",
			)
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
		this.saveFolder = newPath
		// Reset current file path since we're changing folders
		this.currentFilePath = undefined
	}
}
