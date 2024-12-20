import type { DiffStrategy } from './types'
import { UnifiedDiffStrategy } from './strategies/unified'
import { SearchReplaceDiffStrategy } from './strategies/search-replace'
import { SearchReplaceMultisearchDiffStrategy } from './strategies/search-replace-multisearch'
/**
 * Get the appropriate diff strategy for the given model
 * @param model The name of the model being used (e.g., 'gpt-4', 'claude-3-opus')
 * @returns The appropriate diff strategy for the model
 */
export function getDiffStrategy(model: string, fuzzyMatchThreshold?: number, multisearchDiffEnabled?: boolean): DiffStrategy {
    // Use SearchReplaceMultisearchDiffStrategy when multisearch diff is enabled
    // Otherwise fall back to regular SearchReplaceDiffStrategy
    return multisearchDiffEnabled
        ? new SearchReplaceMultisearchDiffStrategy(fuzzyMatchThreshold ?? 1.0)
        : new SearchReplaceDiffStrategy(fuzzyMatchThreshold ?? 1.0)
}

export type { DiffStrategy }
export { UnifiedDiffStrategy, SearchReplaceDiffStrategy, SearchReplaceMultisearchDiffStrategy }
