import fs from 'fs'
import path from 'path'
import os from 'os'
import { ConfigManager, ApiConfigFile } from '../ConfigManager'
import { ApiConfiguration } from '../../../shared/api'

jest.mock('fs')
jest.mock('path')
jest.mock('os')

// Setup fs.promises mock
const mockFsPromises = {
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}')
};

(fs as any).promises = mockFsPromises

describe('ConfigManager', () => {
  let configManager: ConfigManager
  const mockHomedir = '/mock/home'
  const mockConfigPath = '/mock/home/.cline/api-config.json'
  const customConfigPath = '/custom/path'

  beforeEach(() => {
    jest.clearAllMocks();
    (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
    (path.join as jest.Mock).mockImplementation((...args) => {
      if (args[args.length - 1] === 'api-config.json') {
        return mockConfigPath
      }
      return args.join('/')
    });
    (path.dirname as jest.Mock).mockImplementation((p) => p.substring(0, p.lastIndexOf('/')));
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    mockFsPromises.writeFile.mockResolvedValue(undefined);

    // Setup default mock response for readFile
    const defaultConfig: ApiConfigFile = {
      currentApiConfigName: 'default',
      apiConfigs: {
        default: {}
      }
    }
    mockFsPromises.readFile.mockResolvedValue(JSON.stringify(defaultConfig))
  })

  describe('constructor', () => {
    it('should use default config path when not provided', async () => {
      configManager = new ConfigManager()
      expect(path.join).toHaveBeenCalledWith(mockHomedir, '.cline')
      expect(path.join).toHaveBeenCalledWith(expect.any(String), 'api-config.json')
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should use custom config path when provided', async () => {
      configManager = new ConfigManager(customConfigPath)
      expect(path.join).toHaveBeenCalledWith(customConfigPath, 'api-config.json')
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should initialize config file if it does not exist', async () => {
      const defaultConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      };
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Directory doesn't exist
        .mockReturnValueOnce(false) // File doesn't exist

      configManager = new ConfigManager(customConfigPath)
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(mockConfigPath), { recursive: true })
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(defaultConfig, null, 2)
      )
    })

    it('should not initialize config file if it exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true)

      configManager = new ConfigManager(customConfigPath)
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(fs.mkdirSync).not.toHaveBeenCalled()
      expect(mockFsPromises.writeFile).not.toHaveBeenCalled()
    })

    it('should throw error if initialization fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false)
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'))

      configManager = new ConfigManager(customConfigPath)
      
      // Access the initialized promise to trigger and catch the error
      await expect(configManager['initialized']).rejects.toThrow(
        'Failed to initialize config in constructor: Error: Failed to initialize config: Error: Write failed'
      )
    })
  })

  describe('ListConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should list all configs', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {},
          test: {
            apiProvider: 'anthropic'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      const configs = await configManager.ListConfig()
      expect(configs).toEqual([
        { name: 'default' },
        { name: 'test', apiProvider: 'anthropic' }
      ])
    })

    it('should throw error if reading file fails', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Read failed'))

      await expect(configManager.ListConfig()).rejects.toThrow('Failed to list configs: Error: Failed to read config file: Error: Read failed')
    })
  })

  describe('SaveConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should save new config', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      }

      const newConfig: ApiConfiguration = {
        apiProvider: 'anthropic',
        apiKey: 'test-key'
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await configManager.SaveConfig('test', newConfig)

      const writeFileCall = mockFsPromises.writeFile.mock.calls[0]
      expect(writeFileCall[0]).toBe(mockConfigPath)
      
      const writtenConfig = JSON.parse(writeFileCall[1])
      expect(writtenConfig.apiConfigs.test).toEqual(newConfig)
    })

    it('should update existing config', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {},
          test: {
            apiProvider: 'anthropic',
            apiKey: 'old-key'
          }
        }
      }

      const updatedConfig: ApiConfiguration = {
        apiProvider: 'anthropic',
        apiKey: 'new-key'
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await configManager.SaveConfig('test', updatedConfig)

      const writeFileCall = mockFsPromises.writeFile.mock.calls[0]
      expect(writeFileCall[0]).toBe(mockConfigPath)
      
      const writtenConfig = JSON.parse(writeFileCall[1])
      expect(writtenConfig.apiConfigs.test).toEqual(updatedConfig)
    })

    it('should throw error if writing file fails', async () => {
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({
        currentApiConfigName: 'default',
        apiConfigs: { default: {} }
      }))
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(configManager.SaveConfig('test', {})).rejects.toThrow('Failed to save config: Error: Write failed')
    })
  })

  describe('DeleteConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should delete config', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'test',
        apiConfigs: {
          default: {},
          test: {
            apiProvider: 'anthropic'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await configManager.DeleteConfig('test')

      const writeFileCall = mockFsPromises.writeFile.mock.calls[0]
      expect(writeFileCall[0]).toBe(mockConfigPath)
      
      const writtenConfig = JSON.parse(writeFileCall[1])
      expect(writtenConfig.apiConfigs.test).toBeUndefined()
      // Current config name should remain unchanged since the implementation doesn't change it
      expect(writtenConfig.currentApiConfigName).toBe('test')
    })

    it('should throw error when config does not exist', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await expect(configManager.DeleteConfig('nonexistent')).rejects.toThrow(
        "Config 'nonexistent' not found"
      )
    })

    it('should throw error when trying to delete last config', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await expect(configManager.DeleteConfig('default')).rejects.toThrow(
        'Cannot delete the last remaining configuration.'
      )
    })

    it('should throw error if writing file fails', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {},
          test: {}
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(configManager.DeleteConfig('test')).rejects.toThrow('Failed to delete config: Error: Write failed')
    })
  })

  describe('LoadConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should load existing config and update current config name', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          test: {
            apiProvider: 'anthropic',
            apiKey: 'test-key'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      const config = await configManager.LoadConfig('test')
      
      expect(config).toEqual({
        apiProvider: 'anthropic',
        apiKey: 'test-key'
      })

      const writeFileCall = mockFsPromises.writeFile.mock.calls[0]
      expect(writeFileCall[0]).toBe(mockConfigPath)
      
      const writtenConfig = JSON.parse(writeFileCall[1])
      expect(writtenConfig.currentApiConfigName).toBe('test')
    })

    it('should throw error when config does not exist', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await expect(configManager.LoadConfig('nonexistent')).rejects.toThrow(
        "Config 'nonexistent' not found"
      )
    })

    it('should throw error if writing current config fails', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          test: {
            apiProvider: 'anthropic'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(configManager.LoadConfig('test')).rejects.toThrow('Failed to load config: Error: Write failed')
    })
  })

  describe('SetCurrentConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should set current config', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {},
          test: {
            apiProvider: 'anthropic'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await configManager.SetCurrentConfig('test')

      const writeFileCall = mockFsPromises.writeFile.mock.calls[0]
      expect(writeFileCall[0]).toBe(mockConfigPath)
      
      const writtenConfig = JSON.parse(writeFileCall[1])
      expect(writtenConfig.currentApiConfigName).toBe('test')
    })

    it('should throw error when config does not exist', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          default: {}
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))

      await expect(configManager.SetCurrentConfig('nonexistent')).rejects.toThrow(
        "Config 'nonexistent' not found"
      )
    })

    it('should throw error if writing to file fails', async () => {
      const existingConfig: ApiConfigFile = {
        currentApiConfigName: 'default',
        apiConfigs: {
          test: {
            apiProvider: 'anthropic'
          }
        }
      }

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingConfig))
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(configManager.SetCurrentConfig('test')).rejects.toThrow('Failed to set current config: Error: Write failed')
    })
  })

  describe('readConfig', () => {
    beforeEach(async () => {
      configManager = new ConfigManager()
      // Wait for constructor initialization
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should throw error if reading file fails', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Read failed'))

      // We need to call a public method that uses readConfig internally
      await expect(configManager.ListConfig()).rejects.toThrow('Failed to list configs: Error: Failed to read config file: Error: Read failed')
    })

    it('should throw error if JSON parsing fails', async () => {
      mockFsPromises.readFile.mockResolvedValue('invalid json')

      // We need to call a public method that uses readConfig internally  
      await expect(configManager.ListConfig()).rejects.toThrow(/Failed to list configs: Error: Failed to read config file: SyntaxError:.*/)
    })
  })
})