import { DiffStrategy, DiffResult } from "../types"
import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from "../../../integrations/misc/extract-text"

const BUFFER_LINES = 20; // Number of extra context lines to show before and after matches

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= a.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i-1] === b[j-1]) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i-1][j-1] + 1, // substitution
                    matrix[i][j-1] + 1,   // insertion
                    matrix[i-1][j] + 1    // deletion
                );
            }
        }
    }

    return matrix[a.length][b.length];
}

function getSimilarity(original: string, search: string): number {
    if (search === '') {
        return 1;
    }

    // Normalize strings by removing extra whitespace but preserve case
    const normalizeStr = (str: string) => str.replace(/\s+/g, ' ').trim();
    
    const normalizedOriginal = normalizeStr(original);
    const normalizedSearch = normalizeStr(search);
    
    if (normalizedOriginal === normalizedSearch) { return 1; }
    
    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedOriginal, normalizedSearch);
    
    // Calculate similarity ratio (0 to 1, where 1 is exact match)
    const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length);
    return 1 - (distance / maxLength);
}

export class SearchReplaceMultisearchDiffStrategy implements DiffStrategy {
    private fuzzyThreshold: number;
    private bufferLines: number;

    constructor(fuzzyThreshold?: number, bufferLines?: number) {
        // Use provided threshold or default to exact matching (1.0)
        // Note: fuzzyThreshold is inverted in UI (0% = 1.0, 10% = 0.9)
        // so we use it directly here
        this.fuzzyThreshold = fuzzyThreshold ?? 1.0;
        this.bufferLines = bufferLines ?? BUFFER_LINES;
    }

    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Request to replace existing code using a search and replace block.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
The tool will maintain proper indentation and formatting while making changes.
Multiple search/replace blocks can be specified in a single diff.
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
        const rawBlocks = Array.from(diffContent.matchAll(/<<<<<<< SEARCH \((\d+)\)\n([\s\S]*?)\n?=======\n([\s\S]*?)\n?>>>>>>> REPLACE/g));
        const blocks = rawBlocks.map(([full, startStr, searchContent, replaceContent]) => {
            const start = parseInt(startStr, 10);
            const searchLines = searchContent.split(/\r?\n/);
            const end = start + searchLines.length - 1;
            return [full, startStr, end.toString(), searchContent, replaceContent];
        });

        if (blocks.length === 0) {
            return {
                success: false,
                error: `Invalid diff format - missing required SEARCH/REPLACE sections\n\nDebug Info:\n- Expected Format: <<<<<<< SEARCH (start)\\n[search content]\\n=======\\n[replace content]\\n>>>>>>> REPLACE\n- Tip: Make sure to include both SEARCH and REPLACE sections with correct markers and line numbers`
            };
        }

        // First check for overlapping blocks
        let previousEnd = -1;
        let lineAdjustment = 0;
        for (let i = 0; i < blocks.length; i++) {
            const [_, startStr, endStr] = blocks[i];
            const start = parseInt(startStr, 10) + lineAdjustment;
            const end = parseInt(endStr, 10) + lineAdjustment;

            // Check if this block overlaps with the previous block
            // Note: start can equal previousEnd for adjacent blocks
            if (start < previousEnd) {
                return {
                    success: false,
                    error: `Overlapping search blocks detected: Block ${i + 1} (lines ${start}-${end}) overlaps with previous block ending at line ${previousEnd}`
                };
            }
            previousEnd = end;

            // Update line adjustment for next block
            const [, , , searchContent, replaceContent] = blocks[i];
            const searchLines = searchContent.split(/\r?\n/);
            const replaceLines = replaceContent.split(/\r?\n/);
            lineAdjustment += replaceLines.length - searchLines.length;
        }

        // Process each block sequentially
        let currentContent = originalContent;
        const lineEnding = currentContent.includes('\r\n') ? '\r\n' : '\n';

        // Reset line adjustment for actual processing
        lineAdjustment = 0;

        for (const [_, startStr, endStr, searchContent, replaceContent] of blocks) {
            let currentSearchContent = searchContent;
            let currentReplaceContent = replaceContent;

            // Parse line numbers and apply adjustment
            const startLine = parseInt(startStr, 10);
            const endLine = parseInt(endStr, 10);
            const adjustedStartLine = startLine + lineAdjustment;
            const adjustedEndLine = endLine + lineAdjustment;

            // Strip line numbers if present
            if (everyLineHasLineNumbers(currentSearchContent) && everyLineHasLineNumbers(currentReplaceContent)) {
                currentSearchContent = stripLineNumbers(currentSearchContent);
                currentReplaceContent = stripLineNumbers(currentReplaceContent);
            }

            // Split content into lines
            const searchLines = currentSearchContent === '' ? [] : currentSearchContent.split(/\r?\n/);
            const replaceLines = currentReplaceContent === '' ? [] : currentReplaceContent.split(/\r?\n/);
            const originalLines = currentContent.split(/\r?\n/);

            // Validate empty search requirements
            if (searchLines.length === 0) {
                return {
                    success: false,
                    error: `Empty search content is not allowed\n\nDebug Info:\n- Each SEARCH block must contain content to match`
                };
            }

            // Initialize search variables
            let matchIndex = -1;
            let bestMatchScore = 0;
            let bestMatchContent = "";
            const searchChunk = searchLines.join('\n');

            // Validate line range
            const exactStartIndex = adjustedStartLine - 1;
            const exactEndIndex = adjustedEndLine - 1;

            if (exactStartIndex < 0 || exactEndIndex > originalLines.length || exactStartIndex > exactEndIndex) {
                return {
                    success: false,
                    error: `Line range ${adjustedStartLine}-${adjustedEndLine} is invalid (file has ${originalLines.length} lines)\n\nDebug Info:\n- Requested Range: lines ${startLine}-${endLine}\n- Adjusted Range: lines ${adjustedStartLine}-${adjustedEndLine}\n- Line Adjustment: ${lineAdjustment}\n- File Bounds: lines 1-${originalLines.length}`
                };
            }

            // Try exact match first
            const originalChunk = originalLines.slice(exactStartIndex, exactEndIndex + 1).join('\n');
            const similarity = getSimilarity(originalChunk, searchChunk);
            if (similarity >= this.fuzzyThreshold) {
                matchIndex = exactStartIndex;
                bestMatchScore = similarity;
                bestMatchContent = originalChunk;
            } else {
                // Set bounds for buffered search
                const searchStartIndex = Math.max(0, adjustedStartLine - (this.bufferLines + 1));
                const searchEndIndex = Math.min(originalLines.length, adjustedEndLine + this.bufferLines);

                // Middle-out search within bounds
                const midPoint = Math.floor((searchStartIndex + searchEndIndex) / 2);
                let leftIndex = midPoint;
                let rightIndex = midPoint + 1;

                while (leftIndex >= searchStartIndex || rightIndex <= searchEndIndex - searchLines.length) {
                    if (leftIndex >= searchStartIndex) {
                        const originalChunk = originalLines.slice(leftIndex, leftIndex + searchLines.length).join('\n');
                        const similarity = getSimilarity(originalChunk, searchChunk);
                        if (similarity > bestMatchScore) {
                            bestMatchScore = similarity;
                            matchIndex = leftIndex;
                            bestMatchContent = originalChunk;
                        }
                        leftIndex--;
                    }

                    if (rightIndex <= searchEndIndex - searchLines.length) {
                        const originalChunk = originalLines.slice(rightIndex, rightIndex + searchLines.length).join('\n');
                        const similarity = getSimilarity(originalChunk, searchChunk);
                        if (similarity > bestMatchScore) {
                            bestMatchScore = similarity;
                            matchIndex = rightIndex;
                            bestMatchContent = originalChunk;
                        }
                        rightIndex++;
                    }
                }
            }

            // Check if match meets threshold
            if (matchIndex === -1 || bestMatchScore < this.fuzzyThreshold) {
                const originalContentSection = `\n\nOriginal Content:\n${addLineNumbers(
                    originalLines.slice(
                        Math.max(0, adjustedStartLine - 1 - this.bufferLines),
                        Math.min(originalLines.length, adjustedEndLine + this.bufferLines)
                    ).join('\n'),
                    Math.max(1, adjustedStartLine - this.bufferLines)
                )}`;

                const bestMatchSection = bestMatchContent
                    ? `\n\nBest Match Found:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
                    : `\n\nBest Match Found:\n(no match)`;

                return {
                    success: false,
                    error: `No sufficiently similar match found at lines ${adjustedStartLine}-${adjustedEndLine} (${Math.floor(bestMatchScore * 100)}% similar, needs ${Math.floor(this.fuzzyThreshold * 100)}%)\n\nDebug Info:\n- Similarity Score: ${Math.floor(bestMatchScore * 100)}%\n- Required Threshold: ${Math.floor(this.fuzzyThreshold * 100)}%\n- Original Range: lines ${startLine}-${endLine}\n- Adjusted Range: lines ${adjustedStartLine}-${adjustedEndLine}\n- Line Adjustment: ${lineAdjustment}\n\nSearch Content:\n${searchChunk}${bestMatchSection}${originalContentSection}`
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

            // Update content for next iteration
            const beforeMatch = originalLines.slice(0, matchIndex);
            const afterMatch = originalLines.slice(matchIndex + searchLines.length);
            currentContent = [...beforeMatch, ...indentedReplaceLines, ...afterMatch].join(lineEnding);

            // Update line adjustment for next block
            // Calculate how many lines were added or removed by this block
            const lineDifference = replaceLines.length - searchLines.length;
            lineAdjustment += lineDifference;
        }

        return {
            success: true,
            content: currentContent
        };
    }
}
