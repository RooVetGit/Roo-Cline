const vscode = {
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		createTextEditorDecorationType: jest.fn().mockReturnValue({
			dispose: jest.fn(),
		}),
		createWebviewPanel: jest.fn().mockReturnValue({
			webview: {
				options: {},
			},
			dispose: jest.fn(),
		}),
	},
	workspace: {
		onDidSaveTextDocument: jest.fn(),
	},
	Disposable: class {
		dispose() {}
	},
	Uri: {
		file: (path) => ({
			fsPath: path,
			scheme: "file",
			authority: "",
			path: path,
			query: "",
			fragment: "",
			with: jest.fn(),
			toJSON: jest.fn(),
		}),
	},
	EventEmitter: class {
		constructor() {
			this.event = jest.fn()
			this.fire = jest.fn()
		}
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	Position: class {
		constructor(line, character) {
			this.line = line
			this.character = character
		}
	},
	Range: class {
		constructor(startLine, startCharacter, endLine, endCharacter) {
			this.start = new vscode.Position(startLine, startCharacter)
			this.end = new vscode.Position(endLine, endCharacter)
		}
	},
	ThemeColor: class {
		constructor(id) {
			this.id = id
		}
	},
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
	extensions: {},
	commands: {
		getCommands: jest
			.fn()
			.mockResolvedValue([
				"roo-cline.plusButtonClicked",
				"roo-cline.mcpButtonClicked",
				"roo-cline.historyButtonClicked",
				"roo-cline.popoutButtonClicked",
				"roo-cline.settingsButtonClicked",
				"roo-cline.openInNewTab",
				"roo-cline.explainCode",
				"roo-cline.fixCode",
				"roo-cline.improveCode",
			]),
	},
}

// Create mock extension after vscode object is defined
const mockExtension = {
	id: "RooVeterinaryInc.roo-cline",
	extensionUri: vscode.Uri.file("/test/extension/path"),
	isActive: true,
	exports: {
		sidebarProvider: {
			updateGlobalState: jest.fn().mockResolvedValue(undefined),
			storeSecret: jest.fn().mockResolvedValue(undefined),
			readOpenRouterModels: jest.fn().mockResolvedValue({
				"anthropic/claude-3.5-sonnet:beta": {},
				"anthropic/claude-3-sonnet:beta": {},
				"anthropic/claude-3.5-sonnet": {},
				"anthropic/claude-3.5-sonnet-20240620": {},
				"anthropic/claude-3.5-sonnet-20240620:beta": {},
				"anthropic/claude-3.5-haiku:beta": {},
			}),
			refreshOpenRouterModels: jest.fn().mockResolvedValue(undefined),
			getState: jest.fn().mockResolvedValue({ taskHistory: [] }),
			resolveWebviewView: jest.fn(),
			postMessageToWebview: jest.fn(),
		},
		startNewTask: jest.fn().mockResolvedValue(undefined),
	},
	activate: jest.fn(),
}

// Set up extension activation to return exports
mockExtension.activate.mockResolvedValue(mockExtension.exports)

vscode.extensions.getExtension = jest
	.fn()
	.mockImplementation((id) => (id === mockExtension.id ? mockExtension : undefined))

module.exports = vscode
