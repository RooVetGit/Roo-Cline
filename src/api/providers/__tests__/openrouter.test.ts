import { OpenRouterHandler } from '../openrouter'
import { ApiHandlerOptions, ModelInfo } from '../../../shared/api'
import OpenAI from 'openai'
import axios from 'axios'
import { Anthropic } from '@anthropic-ai/sdk'

// Mock dependencies
jest.mock('openai')
jest.mock('axios')
jest.mock('delay', () => jest.fn(() => Promise.resolve()))
jest.mock('../../utils/retry', () => ({
    withRetry: jest.fn().mockImplementation(async function*(fn) {
        const generator = await fn();
        for await (const chunk of generator) {
            yield chunk;
        }
    })
}))

describe('OpenRouterHandler', () => {
    const mockOptions: ApiHandlerOptions = {
        openRouterApiKey: 'test-key',
        openRouterModelId: 'test-model',
        openRouterModelInfo: {
            name: 'Test Model',
            description: 'Test Description',
            maxTokens: 1000,
            contextWindow: 2000,
            supportsPromptCache: true,
            inputPrice: 0.01,
            outputPrice: 0.02
        } as ModelInfo
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('constructor initializes with correct options', () => {
        const handler = new OpenRouterHandler(mockOptions)
        expect(handler).toBeInstanceOf(OpenRouterHandler)
        expect(OpenAI).toHaveBeenCalledWith({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: mockOptions.openRouterApiKey,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/RooVetGit/Roo-Cline',
                'X-Title': 'Roo-Cline',
            },
        })
    })

    describe('getModel', () => {
        test('returns correct model info when options are provided', () => {
            const handler = new OpenRouterHandler(mockOptions)
            const result = handler.getModel()
            
            expect(result).toEqual({
                id: mockOptions.openRouterModelId,
                info: mockOptions.openRouterModelInfo
            })
        })
    
        test('returns default model info when options are not provided', () => {
            const handlerWithoutModelOptions = new OpenRouterHandler({
                openRouterApiKey: 'test-key'
            })
            const result = handlerWithoutModelOptions.getModel()
            
            expect(result).toEqual({
                id: 'anthropic/claude-3.5-sonnet:beta',
                info: expect.any(Object)
            })
        })
    })

    describe('createMessage', () => {
        test('applies correct formatting for Claude models', async () => {
            const claudeOptions = {
                ...mockOptions,
                openRouterModelId: 'anthropic/claude-3-haiku'
            };
            const handler = new OpenRouterHandler(claudeOptions);
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        id: 'test-id',
                        choices: [{
                            delta: {
                                content: 'test response'
                            }
                        }]
                    };
                }
            };
        
            // Mock OpenAI chat.completions.create
            const mockCreate = jest.fn().mockResolvedValue(mockStream);
            (OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
                completions: { create: mockCreate }
            } as any;
        
            // Mock axios.get for generation details
            (axios.get as jest.Mock).mockResolvedValue({
                data: {
                    data: {
                        native_tokens_prompt: 10,
                        native_tokens_completion: 20,
                        total_cost: 0.001
                    }
                }
            });
        
            const systemPrompt = 'test system prompt';
            const messages: Anthropic.Messages.MessageParam[] = [
                { role: 'user' as const, content: 'message 1' },
                { role: 'assistant' as const, content: 'response 1' },
                { role: 'user' as const, content: 'message 2' }
            ];
        
            const generator = handler.createMessage(systemPrompt, messages);
            for await (const _ of generator) { /* consume generator */ }
        
            // Verify OpenAI client was called with correct Claude-specific parameters
            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.model).toBe('anthropic/claude-3-haiku');
            expect(callArgs.max_tokens).toBeUndefined();
            expect(callArgs.temperature).toBe(0);
            expect(callArgs.stream).toBe(true);
            
            // Verify system message has ephemeral cache control
            const systemMessage = callArgs.messages[0];
            expect(systemMessage.role).toBe('system');
            expect(systemMessage.content[0]).toEqual({
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral' }
            });
        
            // Verify user messages have ephemeral cache control
            const userMessages = callArgs.messages.filter((m: OpenAI.Chat.ChatCompletionMessageParam) => m.role === 'user');
            const lastTwoUserMessages = userMessages.slice(-2);
            
            lastTwoUserMessages.forEach((msg: OpenAI.Chat.ChatCompletionMessageParam) => {
                expect(Array.isArray(msg.content)).toBe(true);
                const content = msg.content as Array<{type: string; text: string; cache_control?: {type: string}}>;
                const textParts = content.filter(part => part.type === 'text');
                expect(textParts.length).toBeGreaterThan(0);
                const lastTextPart = textParts[textParts.length - 1];
                expect(lastTextPart.cache_control).toEqual({ type: 'ephemeral' });
            });
        })
    
        test('generates correct stream chunks with default options', async () => {
            const handler = new OpenRouterHandler(mockOptions)
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        id: 'test-id',
                        choices: [{
                            delta: {
                                content: 'test response'
                            }
                        }]
                    }
                }
            }
    
            // Mock OpenAI chat.completions.create
            const mockCreate = jest.fn().mockResolvedValue(mockStream)
            ;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
                completions: { create: mockCreate }
            } as any
    
            // Mock axios.get for generation details
            ;(axios.get as jest.Mock).mockResolvedValue({
                data: {
                    data: {
                        native_tokens_prompt: 10,
                        native_tokens_completion: 20,
                        total_cost: 0.001
                    }
                }
            })
    
            const systemPrompt = 'test system prompt'
            const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user' as const, content: 'test message' }]
    
            const generator = handler.createMessage(systemPrompt, messages)
            const chunks = []
            
            for await (const chunk of generator) {
                chunks.push(chunk)
            }
    
            // Verify stream chunks
            expect(chunks).toHaveLength(3) // text chunk, usage chunk, and final newlines
            expect(chunks[0]).toEqual({
                type: 'text',
                text: 'test response'
            })
            expect(chunks[1]).toEqual({
                type: 'usage',
                inputTokens: 10,
                outputTokens: 20,
                totalCost: 0.001,
                fullResponseText: 'test response'
            })
            expect(chunks[2]).toEqual({
                type: 'text',
                text: '\n\n'
            })
    
            // Verify OpenAI client was called with correct parameters
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                model: mockOptions.openRouterModelId,
                temperature: 0,
                messages: expect.arrayContaining([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'test message' }
                ]),
                stream: true
            }))
        })
    
        test('includes middle-out transform when enabled', async () => {
            const optionsWithMiddleOut = {
                ...mockOptions,
                openRouterUseMiddleOutTransform: true
            }
            const handler = new OpenRouterHandler(optionsWithMiddleOut)
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        id: 'test-id',
                        choices: [{
                            delta: {
                                content: 'test response'
                            }
                        }]
                    }
                }
            }
    
            // Mock OpenAI chat.completions.create
            const mockCreate = jest.fn().mockResolvedValue(mockStream)
            ;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
                completions: { create: mockCreate }
            } as any
    
            // Mock axios.get for generation details
            ;(axios.get as jest.Mock).mockResolvedValue({
                data: {
                    data: {
                        native_tokens_prompt: 10,
                        native_tokens_completion: 20,
                        total_cost: 0.001
                    }
                }
            })
    
            const systemPrompt = 'test system prompt'
            const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user' as const, content: 'test message' }]
    
            const generator = handler.createMessage(systemPrompt, messages)
            for await (const _ of generator) { /* consume generator */ }
    
            // Verify OpenAI client was called with middle-out transform
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                transforms: ['middle-out']
            }))
        })
    
        test('handles generation details fetch failure gracefully', async () => {
            const handler = new OpenRouterHandler(mockOptions)
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        id: 'test-id',
                        choices: [{
                            delta: {
                                content: 'test response'
                            }
                        }]
                    }
                }
            }
        
            // Mock OpenAI chat.completions.create
            const mockCreate = jest.fn().mockResolvedValue(mockStream)
            ;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
                completions: { create: mockCreate }
            } as any
        
            // Mock axios.get to fail
            ;(axios.get as jest.Mock).mockRejectedValue(new Error('Network error'))
        
            const systemPrompt = 'test system prompt'
            const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user' as const, content: 'test message' }]
        
            const generator = handler.createMessage(systemPrompt, messages)
            const chunks = []
            
            for await (const chunk of generator) {
                chunks.push(chunk)
            }
        
            // Should still get text chunks even if usage info fails
            expect(chunks).toHaveLength(2)
            expect(chunks[0]).toEqual({
                type: 'text',
                text: 'test response'
            })
            expect(chunks[1]).toEqual({
                type: 'text',
                text: '\n\n'
            })
        })
        
        test('handles API errors gracefully', async () => {
            const handler = new OpenRouterHandler(mockOptions)
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield {
                        error: {
                            message: 'Test error',
                            code: 500
                        }
                    }
                }
            }
    
            // Mock OpenAI chat.completions.create
            const mockCreate = jest.fn().mockResolvedValue(mockStream)
            ;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
                completions: { create: mockCreate }
            } as any
    
            const systemPrompt = 'test system prompt'
            const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user' as const, content: 'test message' }]
    
            const generator = handler.createMessage(systemPrompt, messages)
            
            await expect(async () => {
                for await (const _ of generator) { /* consume generator */ }
            }).rejects.toThrow('OpenRouter API Error 500: Test error')
        })
    })
})
