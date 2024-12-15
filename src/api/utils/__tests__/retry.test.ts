import { withRetry } from '../retry';
import { ApiStreamChunk, ApiStreamTextChunk } from '../../transform/stream';
import delay from 'delay';

jest.mock('delay');

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (delay as jest.Mock).mockResolvedValue(undefined);
  });

  it('should complete successfully with no retries', async () => {
    const mockChunks: ApiStreamTextChunk[] = [
      { type: 'text', text: 'chunk1' },
      { type: 'text', text: 'chunk2' }
    ];

    const operation = async () => {
      const generator = async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      };
      return generator();
    };

    const result: ApiStreamChunk[] = [];
    for await (const chunk of withRetry(operation)) {
      result.push(chunk);
    }

    expect(result).toEqual(mockChunks);
    expect(delay).not.toHaveBeenCalled();
  });

  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    const mockChunks: ApiStreamTextChunk[] = [
      { type: 'text', text: 'success' }
    ];

    const operation = async () => {
      const generator = async function* () {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        yield mockChunks[0];
      };
      return generator();
    };

    const onRetry = jest.fn();
    const result: ApiStreamChunk[] = [];

    for await (const chunk of withRetry(operation, {
      maxRetries: 10,
      initialDelayMs: 1000,
      onRetry
    })) {
      result.push(chunk);
    }

    expect(attempts).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenNthCalledWith(1, 1000); // First retry
    expect(delay).toHaveBeenNthCalledWith(2, 2000); // Second retry with exponential backoff
    
    // Filter out retry status messages
    const actualResults = result.filter(
      (chunk): chunk is ApiStreamTextChunk => 
      chunk.type === 'text' && chunk.text === 'success'
    );
    expect(actualResults).toEqual(mockChunks);
  });

  it('should throw after max retries exceeded', async () => {
    const operation = async () => {
      const generator = async function* () {
        throw new Error('Persistent failure');
      };
      return generator();
    };

    const onRetry = jest.fn();
    const generator = withRetry(operation, {
      maxRetries: 3,
      initialDelayMs: 1000,
      onRetry
    });

    const result: ApiStreamChunk[] = [];
    await expect(async () => {
      for await (const chunk of generator) {
        result.push(chunk);
      }
    }).rejects.toThrow('Persistent failure');

    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 1000);
    expect(delay).toHaveBeenNthCalledWith(2, 2000);
    expect(delay).toHaveBeenNthCalledWith(3, 4000);

    // Should have yielded retry status messages
    expect(result.length).toBe(3);
    result.forEach(chunk => {
      expect(chunk.type).toBe('text');
      if (chunk.type === 'text') {
        expect(chunk.text).toMatch(/Request failed\. Retrying in \d+ seconds\.\.\./);
      }
    });
  });

  it('should use default options when not provided', async () => {
    let attempts = 0;
    const operation = async () => {
      const generator = async function* () {
        attempts++;
        if (attempts === 1) {
          throw new Error('First attempt failure');
        }
        yield { type: 'text' as const, text: 'success' };
      };
      return generator();
    };

    const result: ApiStreamChunk[] = [];
    for await (const chunk of withRetry(operation)) {
      result.push(chunk);
    }

    expect(attempts).toBe(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledWith(2000); // Default initialDelayMs
  });

  it('should handle custom onRetry callback', async () => {
    const customOnRetry = jest.fn();
    let attempts = 0;

    const operation = async () => {
      const generator = async function* () {
        attempts++;
        if (attempts === 1) {
          throw new Error('Test error');
        }
        yield { type: 'text' as const, text: 'success' };
      };
      return generator();
    };

    for await (const chunk of withRetry(operation, { onRetry: customOnRetry })) {
      // Consume chunks
    }

    expect(customOnRetry).toHaveBeenCalledTimes(1);
    expect(customOnRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      2000
    );
  });
});