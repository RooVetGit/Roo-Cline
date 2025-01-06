import { applyPatch } from "diff"
import { DiffStrategy, DiffResult } from "../types"

export class UnifiedDiffStrategy implements DiffStrategy {
    private fuzzFactor: number
    constructor(fuzzFactor?: number) {
        this.fuzzFactor = fuzzFactor ?? 0
    }

    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Apply a unified diff to a file at the specified path. This tool is useful when you need to make specific modifications to a file based on a set of changes provided in unified diff format, write out the changes similar to a unified diff like \`diff -U2\` would produce.

Parameters:
- path: (required) The path of the file to apply the diff to (relative to the current working directory ${cwd})
- diff: (required) The diff content in unified format to apply to the file.

Use --- and +++ to mark file paths. Include line numbers in @@ lines with format @@ -start,count +start,count @@ to locate changes.

Match indentation with surrounding code. Include surrounding lines like what \`diff -U2\` would produce.

Mark changes with - for removed lines and + for added lines.

Replace complete functions, methods, loops, etc using \`-\` to remove the old code and \`+\` to add the new code.

For moving code:
1. First hunk removes code from original location
2. Second hunk adds code to new location

Use one hunk per logical change. Double check line numbers match the file.

Format Requirements:

1. Header (REQUIRED):
    \`\`\`
    --- path/to/original/file
    +++ path/to/modified/file
    \`\`\`
    - Must include both lines exactly as shown
    - Use actual file paths
    - Timestamps are not to be included

2. Hunks:
    \`\`\`
    @@ -lineStart,lineCount +lineStart,lineCount @@
    -removed line
    +added line
    \`\`\`
    - Each hunk starts with @@ showing line numbers for changes
    - Format: @@ -originalStart,originalCount +newStart,newCount @@
    - Use - for removed/changed lines
    - Use + for new/modified lines
    - Indentation must match exactly

Complete Example:

Original file (with line numbers):
\`\`\`
1 | import { Logger } from '../logger';
2 | 
3 | function calculateTotal(items: number[]): number {
4 |   return items.reduce((sum, item) => {
5 |     return sum + item;
6 |   }, 0);
7 | }
8 | 
9 | export { calculateTotal };
\`\`\`

After applying the diff, the file would look like:
\`\`\`
1 | import { Logger } from '../logger';
2 | 
3 | function calculateTotal(items: number[]): number {
4 |   const total = items.reduce((sum, item) => {
5 |     return sum + item * 1.1;  // Add 10% markup
6 |   }, 0);
7 |   return Math.round(total * 100) / 100;  // Round to 2 decimal places
8 | }
9 | 
10 | export { calculateTotal };
\`\`\`

Diff to modify the file:
\`\`\`
--- src/utils/helper.ts
+++ src/utils/helper.ts
@@ -1,9 +1,10 @@
 import { Logger } from '../logger';
 
 function calculateTotal(items: number[]): number {
-  return items.reduce((sum, item) => {
-    return sum + item;
+  const total = items.reduce((sum, item) => {
+    return sum + item * 1.1;  // Add 10% markup
   }, 0);
+  return Math.round(total * 100) / 100;  // Round to 2 decimal places
 }
 
 export { calculateTotal };
\`\`\`

Usage:
<apply_diff>
<path>File path here</path>
<diff>
Your diff here
</diff>
</apply_diff>`
    }

    applyDiff(originalContent: string, diffContent: string): DiffResult {
        try {
            const result = applyPatch(originalContent, diffContent, {
                fuzzFactor: this.fuzzFactor
            })
            if (result === false) {
                return {
                    success: false,
                    error: "Failed to apply unified diff - patch rejected",
                    details: {
                        searchContent: diffContent,
                        fuzzFactor: this.fuzzFactor
                    }
                }
            }
            return {
                success: true,
                content: result
            }
        } catch (error) {
            return {
                success: false,
                error: `Error applying unified diff: ${error.message}`,
                details: {
                    searchContent: diffContent,
                    fuzzFactor: this.fuzzFactor
                }
            }
        }
    }
}
