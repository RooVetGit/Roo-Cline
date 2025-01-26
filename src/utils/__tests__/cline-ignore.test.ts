import { shouldIgnorePath } from "../cline-ignore"

describe("shouldIgnorePath", () => {
	test("exact match pattern", () => {
		const ignoreContent = "test.txt"
		expect(shouldIgnorePath("test.txt", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("other.txt", ignoreContent)).toBe(false)
	})

	test("wildcard pattern", () => {
		const ignoreContent = "*.txt"
		expect(shouldIgnorePath("test.txt", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("test.js", ignoreContent)).toBe(false)
	})

	test("directory pattern", () => {
		const ignoreContent = "node_modules/"
		expect(shouldIgnorePath("node_modules/package.json", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("src/node_modules.ts", ignoreContent)).toBe(false)
	})

	test("comments and empty lines", () => {
		const ignoreContent = `
      # This is a comment
      test.txt

      # This is also ignored
      *.js
    `
		expect(shouldIgnorePath("test.txt", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("app.js", ignoreContent)).toBe(true)
	})

	test("negation pattern", () => {
		const ignoreContent = `
      *.txt
      !important.txt
      docs/
      !docs/README.txt
    `
		// Matches *.txt but excluded by !important.txt
		expect(shouldIgnorePath("test.txt", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("important.txt", ignoreContent)).toBe(false)

		// Matches docs/ but excluded by !docs/README.txt
		expect(shouldIgnorePath("docs/test.txt", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("docs/README.txt", ignoreContent)).toBe(false)
	})

	test("complex negation pattern combinations", () => {
		const ignoreContent = `
      # Ignore all .log files
      *.log
      # But not debug.log
      !debug.log
      # However, ignore debug.log in tmp/
      tmp/debug.log
    `
		expect(shouldIgnorePath("error.log", ignoreContent)).toBe(true)
		expect(shouldIgnorePath("debug.log", ignoreContent)).toBe(false)
		expect(shouldIgnorePath("tmp/debug.log", ignoreContent)).toBe(true)
	})

	test("negation pattern with reversed order", () => {
		const ignoreContent = `
			!.env.example
			.env*
		`
		// .env.example should be ignored because .env* comes after !.env.example
		expect(shouldIgnorePath(".env.example", ignoreContent)).toBe(true)
		expect(shouldIgnorePath(".env.local", ignoreContent)).toBe(true)
	})
})
