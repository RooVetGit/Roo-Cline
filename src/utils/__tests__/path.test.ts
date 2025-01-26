import { arePathsEqual, getReadablePath } from "../path"
import * as path from "path"
import os from "os"

describe("Path Utilities", () => {
	const originalPlatform = process.platform

	afterEach(() => {
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
		})
	})

	describe("String.prototype.toPosix", () => {
		it("should convert backslashes to forward slashes", () => {
			const windowsPath = "C:\\Users\\test\\file.txt"
			expect(windowsPath.toPosix()).toBe("C:/Users/test/file.txt")
		})

		it("should not modify paths with forward slashes", () => {
			const unixPath = "/home/user/file.txt"
			expect(unixPath.toPosix()).toBe("/home/user/file.txt")
		})

		it("should preserve extended-length Windows paths", () => {
			const extendedPath = "\\\\?\\C:\\Very\\Long\\Path"
			expect(extendedPath.toPosix()).toBe("\\\\?\\C:\\Very\\Long\\Path")
		})
	})

	describe("platform-specific behavior", () => {
		const platforms = ["win32", "darwin", "linux"]
		platforms.forEach((platform) => {
			describe(`on ${platform}`, () => {
				beforeEach(() => {
					Object.defineProperty(process, "platform", { value: platform })
				})

				it("should handle root paths correctly", () => {
					const root = platform === "win32" ? "C:\\" : "/"
					expect(arePathsEqual(root, root + "/")).toBe(true)
					expect(arePathsEqual(root, root + "//")).toBe(true)
				})

				it("should normalize mixed separators", () => {
					const mixedPath =
						platform === "win32" ? "C:\\Users/test\\path/file.txt" : "/Users/test\\path/file.txt"
					const normalPath =
						platform === "win32" ? "C:\\Users\\test\\path\\file.txt" : "/Users/test/path/file.txt"
					expect(arePathsEqual(mixedPath, normalPath)).toBe(true)
				})

				it("should handle parent directory traversal", () => {
					const base = platform === "win32" ? "C:\\Users\\test" : "/Users/test"
					const path1 = path.join(base, "dir", "..", "file.txt")
					const path2 = path.join(base, "file.txt")
					expect(arePathsEqual(path1, path2)).toBe(true)
				})
			})
		})
	})

	describe("arePathsEqual", () => {
		describe("on Windows", () => {
			beforeEach(() => {
				Object.defineProperty(process, "platform", {
					value: "win32",
				})
			})

			it("should compare paths case-insensitively", () => {
				expect(arePathsEqual("C:\\Users\\Test", "c:\\users\\test")).toBe(true)
			})

			it("should handle different path separators", () => {
				// Convert both paths to use forward slashes after normalization
				const path1 = path.normalize("C:\\Users\\Test").replace(/\\/g, "/")
				const path2 = path.normalize("C:/Users/Test").replace(/\\/g, "/")
				expect(arePathsEqual(path1, path2)).toBe(true)
			})

			it("should normalize paths with ../", () => {
				// Convert both paths to use forward slashes after normalization
				const path1 = path.normalize("C:\\Users\\Test\\..\\Test").replace(/\\/g, "/")
				const path2 = path.normalize("C:\\Users\\Test").replace(/\\/g, "/")
				expect(arePathsEqual(path1, path2)).toBe(true)
			})
		})

		describe("on POSIX", () => {
			beforeEach(() => {
				Object.defineProperty(process, "platform", {
					value: "darwin",
				})
			})

			it("should compare paths case-sensitively", () => {
				expect(arePathsEqual("/Users/Test", "/Users/test")).toBe(false)
			})

			it("should normalize paths", () => {
				expect(arePathsEqual("/Users/./Test", "/Users/Test")).toBe(true)
			})

			it("should handle trailing slashes", () => {
				expect(arePathsEqual("/Users/Test/", "/Users/Test")).toBe(true)
			})
		})

		describe("Windows-specific paths", () => {
			beforeEach(() => {
				Object.defineProperty(process, "platform", { value: "win32" })
			})

			it("should handle drive letter case variations", () => {
				expect(arePathsEqual("C:\\Users\\test", "c:\\users\\test")).toBe(true)
				expect(arePathsEqual("D:\\Files\\test", "d:\\files\\test")).toBe(true)
			})

			it("should handle UNC paths", () => {
				expect(arePathsEqual("\\\\server\\share\\folder", "\\\\SERVER\\share\\folder")).toBe(true)
				expect(arePathsEqual("\\\\server\\share\\folder\\", "\\\\server\\share\\folder")).toBe(true)
			})

			it("should handle extended-length paths", () => {
				const path1 = "\\\\?\\C:\\Very\\Long\\Path"
				const path2 = "\\\\?\\C:\\Very\\Long\\Path\\"
				expect(arePathsEqual(path1, path2)).toBe(true)
			})

			it("should handle network drive paths", () => {
				expect(arePathsEqual("Z:\\Shared\\Files", "z:\\shared\\files")).toBe(true)
			})
		})

		describe("path segment variations", () => {
			const platforms = ["win32", "darwin", "linux"]
			platforms.forEach((platform) => {
				describe(`on ${platform}`, () => {
					beforeEach(() => {
						Object.defineProperty(process, "platform", { value: platform })
					})

					it("should handle consecutive separators", () => {
						const base = platform === "win32" ? "C:" : ""
						const path1 = `${base}//home///user////file.txt`
						const path2 = `${base}/home/user/file.txt`
						expect(arePathsEqual(path1, path2)).toBe(true)
					})

					it("should handle current directory references", () => {
						const base = platform === "win32" ? "C:" : ""
						const path1 = `${base}/./home/./user/./file.txt`
						const path2 = `${base}/home/user/file.txt`
						expect(arePathsEqual(path1, path2)).toBe(true)
					})

					it("should handle complex parent directory traversal", () => {
						const base = platform === "win32" ? "C:" : ""
						const path1 = `${base}/a/b/c/../../d/../e/f/../g`
						const path2 = `${base}/a/e/g`
						expect(arePathsEqual(path1, path2)).toBe(true)
					})
				})
			})
		})

		describe("edge cases", () => {
			it("should handle undefined paths", () => {
				expect(arePathsEqual(undefined, undefined)).toBe(true)
				expect(arePathsEqual("/test", undefined)).toBe(false)
				expect(arePathsEqual(undefined, "/test")).toBe(false)
			})

			it("should handle root paths with trailing slashes", () => {
				expect(arePathsEqual("/", "/")).toBe(true)
				expect(arePathsEqual("C:\\", "C:\\")).toBe(true)
			})
		})
	})

	describe("getReadablePath", () => {
		const homeDir = os.homedir()
		const desktop = path.join(homeDir, "Desktop")

		// Helper function to create platform-specific paths
		const createPath = (...segments: string[]) => {
			return path.join(...segments).toPosix()
		}

		it("should return basename when path equals cwd", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			expect(getReadablePath(cwd, cwd)).toBe("project")
		})

		it("should return relative path when inside cwd", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			const filePath = createPath("C:", "Users", "test", "project", "src", "file.txt")
			expect(getReadablePath(cwd, filePath)).toBe("src/file.txt")
		})

		it("should return absolute path when outside cwd", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			const filePath = createPath("C:", "Users", "test", "other", "file.txt")
			expect(getReadablePath(cwd, filePath)).toBe(filePath)
		})

		it("should handle Desktop as cwd", () => {
			const filePath = path.join(desktop, "file.txt")
			expect(getReadablePath(desktop, filePath)).toBe(createPath(filePath))
		})

		it("should handle undefined relative path", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			expect(getReadablePath(cwd)).toBe("project")
		})

		it("should handle parent directory traversal", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			const filePath = "../../other/file.txt"
			const expected = createPath("C:", "Users", "other", "file.txt")
			expect(getReadablePath(cwd, filePath)).toBe(expected)
		})

		it("should normalize paths with redundant segments", () => {
			const cwd = createPath("C:", "Users", "test", "project")
			const filePath = createPath("C:", "Users", "test", "project", ".", "src", "..", "src", "file.txt")
			expect(getReadablePath(cwd, filePath)).toBe("src/file.txt")
		})
	})
})
