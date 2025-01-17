import { parseCommand, isAllowedSingleCommand, validateCommand } from '../command-validation'

describe('Command Validation', () => {
	describe('parseCommand', () => {
		it('splits commands by chain operators', () => {
			expect(parseCommand('npm test && npm run build')).toEqual(['npm test', 'npm run build'])
			expect(parseCommand('npm test || npm run build')).toEqual(['npm test', 'npm run build'])
			expect(parseCommand('npm test; npm run build')).toEqual(['npm test', 'npm run build'])
			expect(parseCommand('npm test | npm run build')).toEqual(['npm test', 'npm run build'])
		})

		it('preserves quoted content', () => {
			expect(parseCommand('npm test "param with | inside"')).toEqual(['npm test "param with | inside"'])
			expect(parseCommand('echo "hello | world"')).toEqual(['echo "hello | world"'])
			expect(parseCommand('npm test "param with && inside"')).toEqual(['npm test "param with && inside"'])
		})

		it('handles subshell patterns', () => {
			expect(parseCommand('npm test $(echo test)')).toEqual(['npm test', 'echo test'])
			expect(parseCommand('npm test `echo test`')).toEqual(['npm test', 'echo test'])
		})

		it('handles empty and whitespace input', () => {
			expect(parseCommand('')).toEqual([])
			expect(parseCommand('	')).toEqual([])
			expect(parseCommand('\t')).toEqual([])
		})

		it('handles PowerShell specific patterns', () => {
			expect(parseCommand('npm test 2>&1 | Select-String "Error"')).toEqual(['npm test 2>&1', 'Select-String "Error"'])
			expect(parseCommand('npm test | Select-String -NotMatch "node_modules" | Select-String "FAIL|Error"'))
				.toEqual(['npm test', 'Select-String -NotMatch "node_modules"', 'Select-String "FAIL|Error"'])
		})
	})

	describe('isAllowedSingleCommand', () => {
		const allowedCommands = ['npm test', 'npm run', 'echo']

		it('matches commands case-insensitively', () => {
			expect(isAllowedSingleCommand('NPM TEST', allowedCommands)).toBe(true)
			expect(isAllowedSingleCommand('npm TEST --coverage', allowedCommands)).toBe(true)
			expect(isAllowedSingleCommand('ECHO hello', allowedCommands)).toBe(true)
		})

		it('matches command prefixes', () => {
			expect(isAllowedSingleCommand('npm test --coverage', allowedCommands)).toBe(true)
			expect(isAllowedSingleCommand('npm run build', allowedCommands)).toBe(true)
			expect(isAllowedSingleCommand('echo "hello world"', allowedCommands)).toBe(true)
		})

		it('rejects non-matching commands', () => {
			expect(isAllowedSingleCommand('npmtest', allowedCommands)).toBe(false)
			expect(isAllowedSingleCommand('dangerous', allowedCommands)).toBe(false)
			expect(isAllowedSingleCommand('rm -rf /', allowedCommands)).toBe(false)
		})

		it('handles undefined/empty allowed commands', () => {
			expect(isAllowedSingleCommand('npm test', undefined as any)).toBe(false)
			expect(isAllowedSingleCommand('npm test', [])).toBe(false)
		})
	})

	describe('validateCommand', () => {
		const allowedCommands = ['npm test', 'npm run', 'echo', 'Select-String']

		it('validates simple commands', () => {
			expect(validateCommand('npm test', allowedCommands)).toBe(true)
			expect(validateCommand('npm run build', allowedCommands)).toBe(true)
			expect(validateCommand('dangerous', allowedCommands)).toBe(false)
		})

		it('validates chained commands', () => {
			expect(validateCommand('npm test && npm run build', allowedCommands)).toBe(true)
			expect(validateCommand('npm test && dangerous', allowedCommands)).toBe(false)
			expect(validateCommand('npm test | Select-String "Error"', allowedCommands)).toBe(true)
			expect(validateCommand('npm test | rm -rf /', allowedCommands)).toBe(false)
		})

		it('handles quoted content correctly', () => {
			expect(validateCommand('npm test "param with | inside"', allowedCommands)).toBe(true)
			expect(validateCommand('echo "hello | world"', allowedCommands)).toBe(true)
			expect(validateCommand('npm test "param with && inside"', allowedCommands)).toBe(true)
		})

		it('validates subshell commands', () => {
			// Allowed subshell commands should pass
			expect(validateCommand('npm test $(echo test)', allowedCommands)).toBe(true)
			expect(validateCommand('npm test `echo hello`', allowedCommands)).toBe(true)
			expect(validateCommand('echo $(echo nested $(echo allowed))', allowedCommands)).toBe(true)

			// Disallowed subshell commands should fail
			expect(validateCommand('npm test $(rm -rf /)', allowedCommands)).toBe(false)
			expect(validateCommand('npm test `dangerous`', allowedCommands)).toBe(false)
			expect(validateCommand('echo $(echo nested $(dangerous))', allowedCommands)).toBe(false)

			// Mixed allowed/disallowed commands should fail
			expect(validateCommand('echo $(echo ok && dangerous)', allowedCommands)).toBe(false)
			expect(validateCommand('npm test $(echo test) && `dangerous`', allowedCommands)).toBe(false)
		})

		it('handles PowerShell patterns', () => {
			expect(validateCommand('npm test 2>&1 | Select-String "Error"', allowedCommands)).toBe(true)
			expect(validateCommand('npm test | Select-String -NotMatch "node_modules" | Select-String "FAIL|Error"', allowedCommands)).toBe(true)
			expect(validateCommand('npm test | Select-String | dangerous', allowedCommands)).toBe(false)
		})

		it('handles empty input', () => {
			expect(validateCommand('', allowedCommands)).toBe(true)
			expect(validateCommand('	', allowedCommands)).toBe(true)
		})

		it('validates complex kubectl commands with chaining and substitution', () => {
			const kubectlAllowed = ['sleep', 'kubectl', 'echo']
			const complexCommand = 'sleep 30 && kubectl get pods -n abc && echo "---" && kubectl logs -n abc $(kubectl get pods -n abc deployment=xyz -o jsonpath=\'{.items[0].metadata.name}\')'
			
			expect(validateCommand(complexCommand, kubectlAllowed)).toBe(true)
			expect(validateCommand(complexCommand.replace('kubectl', 'dangerous'), kubectlAllowed)).toBe(false)
		})
	})
})