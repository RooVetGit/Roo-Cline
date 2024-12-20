import { levenshteinDistance, getSimilarity } from "../utils"

describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
        expect(levenshteinDistance("hello", "hello")).toBe(0)
    })

    it("should handle single character differences", () => {
        expect(levenshteinDistance("hello", "hallo")).toBe(1)
    })

    it("should handle insertions", () => {
        expect(levenshteinDistance("hello", "hello!")).toBe(1)
    })

    it("should handle deletions", () => {
        expect(levenshteinDistance("hello!", "hello")).toBe(1)
    })

    it("should handle completely different strings", () => {
        expect(levenshteinDistance("hello", "world")).toBe(4)
    })

    it("should handle empty strings", () => {
        expect(levenshteinDistance("", "")).toBe(0)
        expect(levenshteinDistance("hello", "")).toBe(5)
        expect(levenshteinDistance("", "hello")).toBe(5)
    })
})

describe("getSimilarity", () => {
    it("should return 1 for identical strings", () => {
        expect(getSimilarity("hello world", "hello world")).toBe(1)
    })

    it("should handle empty search string", () => {
        expect(getSimilarity("hello world", "")).toBe(1)
    })

    it("should normalize whitespace", () => {
        expect(getSimilarity("hello   world", "hello world")).toBe(1)
        expect(getSimilarity("hello\tworld", "hello world")).toBe(1)
        expect(getSimilarity("hello\nworld", "hello world")).toBe(1)
    })

    it("should preserve case sensitivity", () => {
        expect(getSimilarity("Hello World", "hello world")).toBeLessThan(1)
    })

    it("should handle partial matches", () => {
        const similarity = getSimilarity("hello world", "hello there")
        expect(similarity).toBeGreaterThan(0)
        expect(similarity).toBeLessThan(1)
    })

    it("should handle completely different strings", () => {
        const similarity = getSimilarity("hello world", "goodbye universe")
        expect(similarity).toBeGreaterThan(0)
        expect(similarity).toBeLessThan(0.5)
    })
})