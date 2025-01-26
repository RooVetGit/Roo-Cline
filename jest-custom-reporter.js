class CustomReporter {
	constructor(globalConfig, options) {
		this._globalConfig = globalConfig
		this._options = options
	}

	onRunComplete(contexts, results) {
		console.log(
			`\nTests: ${results.numFailedTests} failed, ${results.numPassedTests} passed, ${results.numTotalTests} total`,
		)
	}
}

module.exports = CustomReporter
