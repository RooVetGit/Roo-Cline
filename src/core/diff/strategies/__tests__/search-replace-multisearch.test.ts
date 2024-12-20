import { SearchReplaceMultisearchDiffStrategy } from '../search-replace-multisearch'

describe('SearchReplaceMultisearchDiffStrategy', () => {
    describe('constructor', () => {
        it('should use default values when no parameters provided', () => {
            const strategy = new SearchReplaceMultisearchDiffStrategy()
            expect(strategy['fuzzyThreshold']).toBe(1.0)
            expect(strategy['bufferLines']).toBe(20)
        })

        it('should use provided values', () => {
            const strategy = new SearchReplaceMultisearchDiffStrategy(0.9, 10)
            expect(strategy['fuzzyThreshold']).toBe(0.9)
            expect(strategy['bufferLines']).toBe(10)
        })
    })

    describe('fuzzy matching', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy(0.8) // 80% similarity threshold
        })

        it('should match content with small differences (>80% similar)', () => {
            const originalContent = 'function getData() {\n    const results = fetchData();\n    return results.filter(Boolean);\n}\n'
            const diffContent = `<<<<<<< SEARCH (1)
function getData() {
    const result = fetchData();
    return results.filter(Boolean);
}
=======
function getData() {
    const data = fetchData();
    return data.filter(Boolean);
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe('function getData() {\n    const data = fetchData();\n    return data.filter(Boolean);\n}\n')
            }
        })

        it('should not match when content is too different (<80% similar)', () => {
            const originalContent = 'function processUsers(data) {\n    return data.map(user => user.name);\n}\n'
            const diffContent = `<<<<<<< SEARCH (1)
function handleItems(items) {
    return items.map(item => item.username);
}
=======
function processData(data) {
    return data.map(d => d.value);
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
        })

        it('should normalize whitespace in similarity comparison', () => {
            const originalContent = 'function sum(a, b) {\n    return a + b;\n}\n'
            const diffContent = `<<<<<<< SEARCH (1)
function   sum(a,   b)    {
    return    a + b;
}
=======
function sum(a, b) {
    return a + b + 1;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe('function sum(a, b) {\n    return a + b + 1;\n}\n')
            }
        })
    })

    describe('buffer zone search', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy(1.0, 5) // Exact matching with 5 line buffer
        })

        it('should find matches within buffer zone', () => {
            const originalContent = `
function one() {
    return 1;
}

function two() {
    return 2;
}

function three() {
    return 3;
}`.trim()

            const diffContent = `<<<<<<< SEARCH (5)
function three() {
    return 3;
}
=======
function three() {
    return "three";
}
>>>>>>> REPLACE`

            // Even though we target line 5, it should find the match at lines 9-11
            // because it's within the 5-line buffer zone
            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`function one() {
    return 1;
}

function two() {
    return 2;
}

function three() {
    return "three";
}`)
            }
        })

        it('should not find matches outside buffer zone', () => {
            const originalContent = `
function one() {
    return 1;
}

function two() {
    return 2;
}

function three() {
    return 3;
}

function four() {
    return 4;
}

function five() {
    return 5;
}`.trim()

            const diffContent = `<<<<<<< SEARCH (5)
function five() {
    return 5;
}
=======
function five() {
    return "five";
}
>>>>>>> REPLACE`

            // Targeting line 5, function five() is more than 5 lines away
            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
        })
    })

    describe('multiple search/replace blocks', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy()
        })

        it('should handle overlapping search blocks', () => {
            const originalContent = `
function process() {
    const data = getData();
    const result = transform(data);
    return format(result);
}`.trim()

            const diffContent = `<<<<<<< SEARCH (1)
function process() {
    const data = getData();
    const result = transform(data);
=======
function process() {
    const input = getData();
    const output = transform(input);
>>>>>>> REPLACE

<<<<<<< SEARCH (3)
    const result = transform(data);
    return format(result);
}
=======
    const output = transform(input);
    return format(output);
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('Start line must be greater than previous block')
            }
        })

        it('should handle multiple potential matches', () => {
            const originalContent = `
function log(msg) {
    console.log(msg);
}

function debug(msg) {
    console.log(msg);
}

function error(msg) {
    console.log(msg);
}`.trim()

            const diffContent = `<<<<<<< SEARCH (2)
function log(msg) {
    console.log(msg);
}
=======
function log(msg) {
    console.log('[LOG]', msg);
}
>>>>>>> REPLACE

<<<<<<< SEARCH (6)
function debug(msg) {
    console.log(msg);
}
=======
function debug(msg) {
    console.log('[DEBUG]', msg);
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`function log(msg) {
    console.log('[LOG]', msg);
}

function debug(msg) {
    console.log('[DEBUG]', msg);
}

function error(msg) {
    console.log(msg);
}`)
            }
        })

        it('should handle replacements affecting later matches', () => {
            const originalContent = `
const config = {
    port: 3000,
    host: 'localhost',
    timeout: 5000
};

function getPort() {
    return config.port;
}

function getTimeout() {
    return config.timeout;
}`.trim()

            const diffContent = `<<<<<<< SEARCH (1)
const config = {
    port: 3000,
    host: 'localhost',
    timeout: 5000
};
=======
const CONFIG = {
    PORT: 3000,
    HOST: 'localhost',
    TIMEOUT: 5000
};
>>>>>>> REPLACE

<<<<<<< SEARCH (8)
function getPort() {
    return config.port;
}
=======
function getPort() {
    return CONFIG.PORT;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`const CONFIG = {
    PORT: 3000,
    HOST: 'localhost',
    TIMEOUT: 5000
};

function getPort() {
    return CONFIG.PORT;
}

function getTimeout() {
    return config.timeout;
}`)
            }
        })
    })

    describe('line number adjustments', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy()
        })

        it('should adjust line numbers for subsequent blocks when lines are added', () => {
            const originalContent = `
function one() {
    return 1;
}

function two() {
    return 2;
}

function three() {
    return 3;
}`.trim()

            const diffContent = `<<<<<<< SEARCH (1)
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
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`function one() {
    console.log("Starting...");
    return 1;
}

function two() {
    console.log("Processing...");
    return 2;
}

function three() {
    return 3;
}`)
            }
        })

        it('should adjust line numbers for subsequent blocks when lines are removed', () => {
            const originalContent = `
function one() {
    // Debug line 1
    // Debug line 2
    return 1;
}

function two() {
    return 2;
}`.trim()

            const diffContent = `<<<<<<< SEARCH (1)
function one() {
    // Debug line 1
    // Debug line 2
    return 1;
}
=======
function one() {
    return 1;
}
>>>>>>> REPLACE

<<<<<<< SEARCH (7)
function two() {
    return 2;
}
=======
function two() {
    console.log("Processing...");
    return 2;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`function one() {
    return 1;
}

function two() {
    console.log("Processing...");
    return 2;
}`)
            }
        })
    })

    describe('error handling', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy()
        })

        it('should return error for invalid line range', () => {
            const originalContent = 'function test() {\n    return true;\n}\n'
            const diffContent = `<<<<<<< SEARCH (5)
function test() {
    return true;
}
=======
function test() {
    return false;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('Line range 5-7 is invalid')
            }
        })

        it('should return error for empty search content', () => {
            const originalContent = 'function test() {\n    return true;\n}\n'
            const diffContent = `<<<<<<< SEARCH (1)
=======
function test() {
    return false;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('Empty search content is not allowed')
            }
        })

        it('should return error with debug info when no match found', () => {
            const originalContent = 'function test() {\n    return true;\n}\n'
            const diffContent = `<<<<<<< SEARCH (1)
function test() {
    return different;
}
=======
function test() {
    return false;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('Debug Info:')
                expect(result.error).toContain('Similarity Score:')
                expect(result.error).toContain('Required Threshold:')
            }
        })
    })

    describe('indentation handling', () => {
        let strategy: SearchReplaceMultisearchDiffStrategy

        beforeEach(() => {
            strategy = new SearchReplaceMultisearchDiffStrategy()
        })

        it('should preserve indentation when adding lines', () => {
            const originalContent = `
class Example {
    constructor() {
        this.value = 0;
    }
}`.trim()

            const diffContent = `<<<<<<< SEARCH (2)
    constructor() {
        this.value = 0;
    }
=======
    constructor() {
        // Initialize value
        this.value = 0;
        this.ready = true;
    }
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`class Example {
    constructor() {
        // Initialize value
        this.value = 0;
        this.ready = true;
    }
}`)
            }
        })

        it('should handle mixed indentation styles', () => {
            const originalContent = `class Example {
\tconstructor() {
\t    this.value = 0;
\t}
}`

            const diffContent = `<<<<<<< SEARCH (2)
\tconstructor() {
\t    this.value = 0;
\t}
=======
\tconstructor() {
\t    // Add comment
\t    this.value = 1;
\t}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.content).toBe(`class Example {
\tconstructor() {
\t    // Add comment
\t    this.value = 1;
\t}
}`)
            }
        })
    })
})
