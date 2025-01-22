// Separate enhance prompt type and definition
export type EnhanceConfig = {
	prompt: string
}

export const enhance: EnhanceConfig = {
	prompt: "Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):",
} as const

// Completely separate enhance prompt handling
export const enhancePrompt = {
	default: enhance.prompt,
	get: (customPrompts: Record<string, any> | undefined): string => {
		return customPrompts?.enhance ?? enhance.prompt
	},
} as const

// Code action prompts
type PromptParams = Record<string, string | any[]>

const generateDiagnosticText = (diagnostics?: any[]) => {
	if (!diagnostics?.length) return ""
	return `\nCurrent problems detected:\n${diagnostics
		.map((d) => `- [${d.source || "Error"}] ${d.message}${d.code ? ` (${d.code})` : ""}`)
		.join("\n")}`
}

export const createPrompt = (template: string, params: PromptParams): string => {
	let result = template
	for (const [key, value] of Object.entries(params)) {
		if (key === "diagnostics") {
			result = result.replaceAll("${diagnosticText}", generateDiagnosticText(value as any[]))
		} else {
			result = result.replaceAll(`\${${key}}`, value as string)
		}
	}

	// Replace any remaining user_input placeholders with empty string
	result = result.replaceAll("${userInput}", "")

	return result
}

const EXPLAIN_TEMPLATE = `
Explain the following code from file path @/\${filePath}:
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please provide a clear and concise explanation of what this code does, including:
1. The purpose and functionality
2. Key components and their interactions
3. Important patterns or techniques used
`

const FIX_TEMPLATE = `
Fix any issues in the following code from file path @/\${filePath}
\${diagnosticText}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please:
1. Address all detected problems listed above (if any)
2. Identify any other potential bugs or issues
3. Provide corrected code
4. Explain what was fixed and why
`

const IMPROVE_TEMPLATE = `
Improve the following code from file path @/\${filePath}:
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please suggest improvements for:
1. Code readability and maintainability
2. Performance optimization
3. Best practices and patterns
4. Error handling and edge cases

Provide the improved code along with explanations for each enhancement.
`

// Get template based on prompt type
const defaultTemplates = {
	EXPLAIN: EXPLAIN_TEMPLATE,
	FIX: FIX_TEMPLATE,
	IMPROVE: IMPROVE_TEMPLATE,
} as const

type CodeActionType = keyof typeof defaultTemplates

export const codeActionPrompt = {
	default: defaultTemplates,
	get: (customPrompts: Record<string, any> | undefined, type: CodeActionType): string => {
		return customPrompts?.[type] ?? defaultTemplates[type]
	},
	create: (type: CodeActionType, params: PromptParams, customPrompts?: Record<string, any>): string => {
		const template = codeActionPrompt.get(customPrompts, type)
		return createPrompt(template, params)
	},
} as const

export type { CodeActionType }

// User-friendly labels for code action types
export const codeActionLabels: Record<CodeActionType, string> = {
	FIX: "Fix Issues",
	EXPLAIN: "Explain Code",
	IMPROVE: "Improve Code",
} as const