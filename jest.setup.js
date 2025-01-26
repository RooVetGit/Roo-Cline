// Only silence console output if not in debug mode
if (!process.env.DEBUG) {
	console.log = () => {}
	console.info = () => {}
	console.warn = () => {}
	console.error = () => {}
}

process.env.NODE_NO_WARNINGS = "1"

// Set up mock API key for tests
process.env.OPEN_ROUTER_API_KEY = "sk-or-v1-mock-key-for-testing"
