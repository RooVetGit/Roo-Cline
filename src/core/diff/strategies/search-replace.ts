import { DiffStrategy } from "../types"

export class SearchReplaceDiffStrategy implements DiffStrategy {
    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Request to replace existing code using search and replace blocks.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
Only use this tool when you need to replace/fix existing code.
The tool will maintain proper indentation and formatting while making changes.
Only a single operation is allowed per tool use.
The SEARCH section must exactly match existing content including whitespace and indentation.

Parameters:
- path: (required) The path of the file to modify (relative to the current working directory ${cwd})
- diff: (required) The search/replace blocks defining the changes.

Format:
1. First line must be the file path
2. Followed by search/replace blocks:
   \`\`\`
   <<<<<<< SEARCH
   [exact content to find including whitespace]
   =======
   [new content to replace with]
   >>>>>>> REPLACE
   \`\`\`

Example:

Original file:
\`\`\`
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
\`\`\`

Search/Replace content:
\`\`\`
main.py
<<<<<<< SEARCH
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE
\`\`\`

Usage:
<apply_diff>
<path>File path here</path>
<diff>
Your search/replace content here
</diff>
</apply_diff>`
    }

    applyDiff(originalContent: string, diffContent: string): string | false {
        // Extract the search and replace blocks
        const match = diffContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
        if (!match) {
            return false;
        }

        const [_, searchContent, replaceContent] = match;
        
        // Trim both search and replace content
        const trimmedSearch = searchContent.trim();
        const trimmedReplace = replaceContent.trim();
        
        // Trim the original content for comparison
        const trimmedOriginal = originalContent.trim();
        
        // Verify the search content exists in the trimmed original
        if (!trimmedOriginal.includes(trimmedSearch)) {
            return false;
        }

        // Replace the content, maintaining original whitespace
        return originalContent.replace(trimmedSearch, trimmedReplace);
    }
}
