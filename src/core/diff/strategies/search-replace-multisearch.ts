import { DiffStrategy, DiffResult } from "../types"
import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from "../../../integrations/misc/extract-text"
import { getSimilarity } from "../utils"

const BUFFER_LINES = 20; // Number of extra context lines to show before and after matches

export class SearchReplaceMultisearchDiffStrategy implements DiffStrategy {
    private fuzzyThreshold: number;
    private bufferLines: number;

    constructor(fuzzyThreshold?: number, bufferLines?: number) {
        // Use provided threshold or default to exact matching (1.0)
        this.fuzzyThreshold = fuzzyThreshold ?? 1.0;
        this.bufferLines = bufferLines ?? BUFFER_LINES;
    }

    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Request to replace existing code using a search and replace block.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
The tool will maintain proper indentation and formatting while making changes.
Multiple search/replace blocks can be specified in a single diff, but they must be in order.
The SEARCH section must exactly match existing content including whitespace and indentation.
If you're not confident in the exact content to search for, use the read_file tool first to get the exact content.

Parameters:
- path: (required) The path of the file to modify (relative to the current working directory ${cwd})
- diff: (required) The search/replace block defining the changes.

Line Number Behavior:
- Line numbers are specified in the SEARCH marker: <<<<<<< SEARCH (start_line)
- For multiple blocks, line numbers are automatically adjusted based on lines added/removed by previous blocks
- Example: If block 1 adds 2 lines and block 2's target was at line 10, it will be automatically adjusted to line 12

Diff format:
\`\`\`
<<<<<<< SEARCH (start_line)
[exact content to find including whitespace]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

Example with multiple blocks:
\`\`\`
<<<<<<< SEARCH (1)
function one() {
    return 1;
}
=======
function one() {
    console.log("Starting...");
    return 1;
}
>>>>>>> REPLACE
<<<<<<< SEARCH (5)
function two() {
    return 2;
}
=======
function two() {
    console.log("Processing...");
    return 2;
}
>>>>>>> REPLACE
\`\`\`

In this example:
1. First block starts at line 1 and matches 3 lines (the function definition)
2. First block adds 1 line (console.log), so subsequent line numbers are shifted by +1
3. Second block starts at line 5, but is automatically adjusted to line 6 due to the previous +1 shift

Usage:
<apply_diff>
<path>File path here</path>
<diff>
[search/replace blocks here]
</diff>
</apply_diff>`
    }

    applyDiff(originalContent: string, diffContent: string): DiffResult {
        // Extract all search and replace blocks with start line numbers and compute end lines
        const blockPattern = /<<<<<<< SEARCH \((\d+)(?:-\d+)?\)\n([\s\S]*?)\n?=======\n([\s\S]*?)\n?>>>>>>> REPLACE/g;
        const rawBlocks = Array.from(diffContent.matchAll(blockPattern));
        const blocks = rawBlocks.map(([full, startStr, searchContent, replaceContent]) => {
            const start = parseInt(startStr, 10);
            const searchLines = searchContent.split(/\r?\n/);
            const end = start + searchLines.length - 1;
            return [full, startStr, end.toString(), searchContent, replaceContent];
        });

        // Validate blocks
        if (blocks.length === 0) {
            return {
                success: false,
                error: "Invalid diff format - missing required SEARCH/REPLACE sections\n\nDebug Info:\n- Expected Format: <<<<<<< SEARCH (start-end)\\n[search content]\\n=======\\n[replace content]\\n>>>>>>> REPLACE\n- Tip: Make sure to include both SEARCH and REPLACE sections with correct markers and line numbers"
            };
        }

        let prevEnd = -1;

        // Then validate individual blocks
        for (const block of blocks) {
            const [_, startStr, endStr, searchContent] = block;
            // Check for empty search content
            const searchLines = searchContent.split(/\r?\n/);
            if (searchLines.length === 0 || searchLines.every(line => line.trim() === '')) {
                return {
                    success: false,
                    error: "Empty search content is not allowed\n\nDebug Info:\n- Each SEARCH block must contain content to match"
                };
            }

            // Validate line numbers
            const startLine = parseInt(startStr, 10);
            const endLine = parseInt(endStr, 10);
            if (startLine < 1 || endLine < startLine || startLine <= prevEnd) {
                return {
                    success: false,
                    error: `Invalid line range ${startLine}-${endLine}\n\nDebug Info:\n- Start line must be >= 1\n- End line must be >= start line\n- Start line must be greater than previous block's end line`
                };
            }

            prevEnd = endLine;
        }

        // Process blocks sequentially
        let lineAdjustment = 0;
        let currentContent = originalContent;
        const lineEnding = currentContent.includes('\r\n') ? '\r\n' : '\n';

        for (const [_, startStr, endStr, searchContent, replaceContent] of blocks) {
            let currentSearchContent = searchContent;
            let currentReplaceContent = replaceContent;

            // Parse line numbers and apply adjustment
            const startLine = parseInt(startStr, 10);
            const endLine = parseInt(endStr, 10);
            const adjustedStartLine = startLine + lineAdjustment;
            const adjustedEndLine = endLine + lineAdjustment;

            // Split content into lines for validation
            const originalLines = currentContent.split(/\r?\n/);

            // Validate line range
            if (adjustedStartLine < 1 || adjustedEndLine > originalLines.length) {
                return {
                    success: false,
                    error: `Line range ${startLine}-${endLine} is invalid\n\nDebug Info:\n- Original Range: lines ${startLine}-${endLine}\n- Adjusted Range: lines ${adjustedStartLine}-${adjustedEndLine}\n- Line Adjustment: ${lineAdjustment}\n- File Bounds: lines 1-${originalLines.length}`
                };
            }

            // Strip line numbers if present
            if (everyLineHasLineNumbers(currentSearchContent) && everyLineHasLineNumbers(currentReplaceContent)) {
                currentSearchContent = stripLineNumbers(currentSearchContent);
                currentReplaceContent = stripLineNumbers(currentReplaceContent);
            }

            // Split search and replace content into lines
            const searchLines = currentSearchContent.split(/\r?\n/);
            const replaceLines = currentReplaceContent.split(/\r?\n/);

            // Initialize search variables
            let matchIndex = -1;
            let bestMatchScore = 0;
            let bestMatchContent = "";
            const searchChunk = searchLines.join('\n');

            // Try exact match at adjusted line first
            const exactMatchChunk = originalLines.slice(adjustedStartLine - 1, adjustedEndLine).join('\n');
            const exactMatchScore = getSimilarity(exactMatchChunk, searchChunk);
            if (exactMatchScore >= this.fuzzyThreshold) {
                matchIndex = adjustedStartLine - 1;
                bestMatchScore = exactMatchScore;
                bestMatchContent = exactMatchChunk;
            }

            // If exact match fails, try buffer zone
            if (matchIndex === -1) {
                // Search within buffer zone
                const searchStartIndex = Math.max(0, adjustedStartLine - this.bufferLines - 1);
                const searchEndIndex = Math.min(originalLines.length - searchLines.length + 1, adjustedEndLine + this.bufferLines);

                // Sequential search through buffer zone
                for (let i = searchStartIndex; i <= searchEndIndex; i++) {
                    const originalChunk = originalLines.slice(i, i + searchLines.length).join('\n');
                    const similarity = getSimilarity(originalChunk, searchChunk);
                    if (similarity >= this.fuzzyThreshold && similarity > bestMatchScore) {
                        bestMatchScore = similarity;
                        matchIndex = i;
                        bestMatchContent = originalChunk;
                    }
                }
            }

            // If no match found, fail with debug info
            if (matchIndex === -1) {
                return {
                    success: false,
                    error: `No matches found within buffer zone\n\nDebug Info:\n- Buffer Zone: ${this.bufferLines} lines\n- Target Line: ${startLine}\n- Similarity Score: ${Math.floor(bestMatchScore * 100)}%\n- Required Threshold: ${Math.floor(this.fuzzyThreshold * 100)}%\n- Search Range: lines ${adjustedStartLine}-${adjustedEndLine}\n- Content to match:\n${searchChunk}\n- Best match found:\n${bestMatchContent}`
                };
            }

            // Get matched lines and handle indentation
            const matchedLines = originalLines.slice(matchIndex, matchIndex + searchLines.length);
            const originalIndents = matchedLines.map((line: string) => {
                const match = line.match(/^[\t ]*/);
                return match ? match[0] : '';
            });

            const searchIndents = searchLines.map((line: string) => {
                const match = line.match(/^[\t ]*/);
                return match ? match[0] : '';
            });

            const indentedReplaceLines = replaceLines.map((line: string, i: number) => {
                const matchedIndent = originalIndents[0] || '';
                const currentIndentMatch = line.match(/^[\t ]*/);
                const currentIndent = currentIndentMatch ? currentIndentMatch[0] : '';
                const searchBaseIndent = searchIndents[0] || '';
                
                const searchBaseLevel = searchBaseIndent.length;
                const currentLevel = currentIndent.length;
                const relativeLevel = currentLevel - searchBaseLevel;
                
                const finalIndent = relativeLevel < 0
                    ? matchedIndent.slice(0, Math.max(0, matchedIndent.length + relativeLevel))
                    : matchedIndent + currentIndent.slice(searchBaseLevel);
                
                return finalIndent + line.trim();
            });

            // Update content and line adjustment for next iteration
            const beforeMatch = originalLines.slice(0, matchIndex);
            const afterMatch = originalLines.slice(matchIndex + searchLines.length);
            currentContent = [...beforeMatch, ...indentedReplaceLines, ...afterMatch].join(lineEnding);

            // Update line adjustment for next block
            lineAdjustment += replaceLines.length - searchLines.length;
        }

        return {
            success: true,
            content: currentContent
        };
    }
}
