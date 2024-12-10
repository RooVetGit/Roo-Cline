import { SearchReplaceDiffStrategy } from '../search-replace'

describe('SearchReplaceDiffStrategy', () => {
    let strategy: SearchReplaceDiffStrategy

    beforeEach(() => {
        strategy = new SearchReplaceDiffStrategy()
    })

    describe('applyDiff', () => {
        it('should replace matching content', () => {
            const originalContent = `function hello() {
    console.log("hello")
}
`
            const diffContent = `test.ts
<<<<<<< SEARCH
function hello() {
    console.log("hello")
}
=======
function hello() {
    console.log("hello world")
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(`function hello() {
    console.log("hello world")
}
`)
        })

        it('should handle extra whitespace in search/replace blocks', () => {
            const originalContent = `function test() {
    return true;
}
`
            const diffContent = `test.ts
<<<<<<< SEARCH

function test() {
    return true;
}

=======
function test() {
    return false;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(`function test() {
    return false;
}
`)
        })

        it('should match content with different surrounding whitespace', () => {
            const originalContent = `
function example() {
    return 42;
}

`
            const diffContent = `test.ts
<<<<<<< SEARCH
function example() {
    return 42;
}
=======
function example() {
    return 43;
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(`
function example() {
    return 43;
}

`)
        })

        it('should return false if search content does not match', () => {
            const originalContent = `function hello() {
    console.log("hello")
}
`
            const diffContent = `test.ts
<<<<<<< SEARCH
function hello() {
    console.log("wrong")
}
=======
function hello() {
    console.log("hello world")
}
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(false)
        })

        it('should return false if diff format is invalid', () => {
            const originalContent = `function hello() {
    console.log("hello")
}
`
            const diffContent = `test.ts
Invalid diff format`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(false)
        })

        it('should handle multiple lines with proper indentation', () => {
            const originalContent = `class Example {
    constructor() {
        this.value = 0
    }

    getValue() {
        return this.value
    }
}
`
            const diffContent = `test.ts
<<<<<<< SEARCH
    getValue() {
        return this.value
    }
=======
    getValue() {
        // Add logging
        console.log("Getting value")
        return this.value
    }
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe(`class Example {
    constructor() {
        this.value = 0
    }

    getValue() {
        // Add logging
        console.log("Getting value")
        return this.value
    }
}
`)
        })

        it('should preserve whitespace exactly in the output', () => {
            const originalContent = "    indented\n        more indented\n    back\n"
            const diffContent = `test.ts
<<<<<<< SEARCH
    indented
        more indented
    back
=======
    modified
        still indented
    end
>>>>>>> REPLACE`

            const result = strategy.applyDiff(originalContent, diffContent)
            expect(result).toBe("    modified\n        still indented\n    end\n")
        })
    })

    describe('getToolDescription', () => {
        it('should include the current working directory', () => {
            const cwd = '/test/dir'
            const description = strategy.getToolDescription(cwd)
            expect(description).toContain(`relative to the current working directory ${cwd}`)
        })

        it('should include required format elements', () => {
            const description = strategy.getToolDescription('/test')
            expect(description).toContain('<<<<<<< SEARCH')
            expect(description).toContain('=======')
            expect(description).toContain('>>>>>>> REPLACE')
            expect(description).toContain('<apply_diff>')
            expect(description).toContain('</apply_diff>')
        })
    })
})
