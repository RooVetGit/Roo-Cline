import {
	AssistantMessageContent,
	ToolParamName,
	toolParamNames,
	toolUseNames,
	ToolUseName,
} from "."

/**
 * Parses an assistant message containing text and tool use blocks.
 *
 * Algorithm:
 * 1. Iteratively processes the message string until no content remains
 * 2. For each iteration:
 *    - Searches for the next tool tag (format: <tool_name>)
 *    - If no tool found, treats remaining content as text and exits
 *    - Validates the tool name against known tools
 *    - Extracts any text content before the tool as a separate block
 *    - Locates the tool's closing tag (</tool_name>) by finding the LAST matching
 *      closing tag in the remaining text. This ensures we match the outermost
 *      tags when there are nested tools of the same type
 *    - Parses tool parameters within the tool block:
 *      * Parameters follow format: <param_name>value</param_name>
 *      * Orders parameters by position and extracts values
 *      * Filters out empty parameters
 *    - Creates a tool_use block with parsed parameters
 *    - Continues with remaining text after the tool's closing tag
 *
 * Returns an array of content blocks, where each block is either:
 * - Text content: { type: "text", content: string, partial: boolean }
 * - Tool use: { type: "tool_use", name: string, params: Record<string, string>, partial: boolean }
 */

export function parseAssistantMessage(assistantMessage: string) {
    let contentBlocks: AssistantMessageContent[] = []
    let remainingText = assistantMessage

    while (remainingText.length > 0) {
        // Look for the next tool use from the start
        const toolMatch = remainingText.match(/<([\w_]+)>/) as RegExpMatchArray

        if (!toolMatch) {
            // No more tools, rest is text
            if (remainingText.trim()) {
                contentBlocks.push({
                    type: "text",
                    content: remainingText.trim(),
                    partial: true
                })
            }
            break
        }

        const toolName = toolMatch[1] as ToolUseName
        if (!toolUseNames.includes(toolName)) {
            // Find the closing tag for this invalid tool
            const invalidClosingTag = `</${toolName}>`
            const closeIndex = remainingText.indexOf(invalidClosingTag)
            
            // Take the entire invalid tag block as text
            const textBlock = closeIndex !== -1
                ? remainingText.slice(0, closeIndex + invalidClosingTag.length)
                : remainingText.slice(0, toolMatch.index! + toolMatch[0].length)
                
            contentBlocks.push({
                type: "text",
                content: textBlock,
                partial: false
            })
            
            remainingText = closeIndex !== -1
                ? remainingText.slice(closeIndex + invalidClosingTag.length)
                : remainingText.slice(toolMatch.index! + toolMatch[0].length)
            continue
        }

        // If there's text before the tool, add it as a block
        const textBeforeTool = remainingText.slice(0, toolMatch.index).trim()
        if (textBeforeTool) {
            contentBlocks.push({
                type: "text",
                content: textBeforeTool,
                partial: false
            })
        }

        // Find the matching closing tag
        const toolClosingTag = `</${toolName}>`
        const toolCloseIndex = remainingText.lastIndexOf(toolClosingTag)

        // Extract tool content
        const matchIndex = toolMatch!.index!
        const matchLength = toolMatch![0]!.length
        const toolContent = toolCloseIndex === -1
            ? remainingText.slice(matchIndex + matchLength)
            : remainingText.slice(matchIndex + matchLength, toolCloseIndex)

        // Parse parameters
        const params: Record<ToolParamName, string> = Object.fromEntries(
            toolParamNames.map(name => [name, ""])
        ) as Record<ToolParamName, string>

        const paramPositions = toolParamNames.map(name => ({
            name,
            start: toolContent.indexOf(`<${name}>`)
        })).filter(p => p.start !== -1).sort((a, b) => a.start - b.start)

        for (let i = 0; i < paramPositions.length; i++) {
            const param = paramPositions[i]
            const nextStart = paramPositions[i + 1]?.start || toolContent.length
            const valueStart = param.start + param.name.length + 2
            const valueEnd = toolContent.lastIndexOf(`</${param.name}>`, nextStart)

            if (valueEnd > valueStart) {
                params[param.name] = toolContent.slice(valueStart, valueEnd).trim()
            } else {
                params[param.name] = toolContent.slice(valueStart).trim()
            }
        }

        // Filter out empty parameters
        const nonEmptyParams = Object.fromEntries(
            Object.entries(params).filter(([_, value]) => value !== "")
        ) as Record<ToolParamName, string>

        contentBlocks.push({
            type: "tool_use",
            name: toolName,
            params: nonEmptyParams,
            partial: toolCloseIndex === -1
        })

        // Move past this tool
        remainingText = toolCloseIndex === -1
            ? ""
            : remainingText.slice(toolCloseIndex + toolClosingTag.length)
    }

    return contentBlocks
}
