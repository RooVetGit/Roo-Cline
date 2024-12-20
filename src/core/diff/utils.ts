export function levenshteinDistance(a: string, b: string): number {
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

export function getSimilarity(original: string, search: string): number {
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