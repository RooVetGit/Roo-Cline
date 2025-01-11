import { SlackNotifier } from '../services/slack'

describe('SlackNotifier', () => {
    let slackNotifier: SlackNotifier
    let mockFetch: jest.Mock

    beforeEach(() => {
        mockFetch = jest.fn()
        global.fetch = mockFetch
        slackNotifier = new SlackNotifier({
            webhookUrl: 'https://hooks.slack.com/services/test',
            enabled: true
        })
    })

    afterEach(() => {
        jest.resetAllMocks()
    })

    it('should send task completion notification', async () => {
        await slackNotifier.notifyTaskComplete('Task completed successfully')
        expect(mockFetch).toHaveBeenCalledWith(
            'https://hooks.slack.com/services/test',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '✅ Task Complete: Task completed successfully' })
            })
        )
    })

    it('should send user input needed notification', async () => {
        await slackNotifier.notifyUserInputNeeded('What is your preference?')
        expect(mockFetch).toHaveBeenCalledWith(
            'https://hooks.slack.com/services/test',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '❓ User Input Received: What is your preference?' })
            })
        )
    })

    it('should send task failed notification', async () => {
        await slackNotifier.notifyTaskFailed('Error occurred')
        expect(mockFetch).toHaveBeenCalledWith(
            'https://hooks.slack.com/services/test',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '❌ Task Failed: Error occurred' })
            })
        )
    })

    it('should not send notifications when disabled', async () => {
        slackNotifier = new SlackNotifier({
            webhookUrl: 'https://hooks.slack.com/services/test',
            enabled: false
        })

        await slackNotifier.notifyTaskComplete('Task completed')
        await slackNotifier.notifyUserInputNeeded('Input needed')
        await slackNotifier.notifyTaskFailed('Task failed')

        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle fetch errors gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))
        
        // These should not throw errors
        await expect(slackNotifier.notifyTaskComplete('Task completed')).resolves.not.toThrow()
        await expect(slackNotifier.notifyUserInputNeeded('Input needed')).resolves.not.toThrow()
        await expect(slackNotifier.notifyTaskFailed('Task failed')).resolves.not.toThrow()
    })
})