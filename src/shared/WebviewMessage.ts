import { ApiConfiguration, ApiProvider } from "./api"
import { MessagingConfig } from "./ExtensionMessage"

export type AudioType = "notification" | "celebration" | "progress_loop"

export interface WebviewMessage {
	type:
		| "apiConfiguration"
		| "currentApiConfigName"
		| "upsertApiConfiguration"
		| "deleteApiConfiguration"
		| "loadApiConfiguration"
		| "renameApiConfiguration"
		| "getListApiConfiguration"
		| "customInstructions"
		| "allowedCommands"
		| "alwaysAllowReadOnly"
		| "alwaysAllowWrite"
		| "alwaysAllowExecute"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "resetState"
		| "requestOllamaModels"
		| "requestLmStudioModels"
		| "openImage"
		| "openFile"
		| "openMention"
		| "cancelTask"
		| "refreshGlamaModels"
		| "refreshOpenRouterModels"
		| "refreshOpenAiModels"
		| "alwaysAllowBrowser"
		| "alwaysAllowMcp"
		| "playSound"
		| "soundEnabled"
		| "soundVolume"
		| "diffEnabled"
		| "browserViewportSize"
		| "screenshotQuality"
		| "openMcpSettings"
		| "restartMcpServer"
		| "toggleToolAlwaysAllow"
		| "toggleMcpServer"
		| "fuzzyMatchThreshold"
		| "preferredLanguage"
		| "writeDelayMs"
		| "enhancePrompt"
		| "enhancedPrompt"
		| "draggedImages"
		| "deleteMessage"
		| "terminalOutputLineLimit"
		| "mcpEnabled"
		| "searchCommits"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "setApiConfigPassword"
		| "messagingConfig"
	text?: string
	disabled?: boolean
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	value?: number
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	dataUrls?: string[]
	values?: Record<string, any>
	query?: string
	messagingConfig?: MessagingConfig
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"
