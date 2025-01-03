import { GitProvider } from '../GitProvider';
import * as vscode from 'vscode';
import { API as GitAPI, Change, Repository } from '../../../@types/vscode.git';
import { Status } from '../../../@types/vscode.git';

jest.mock('vscode', () => {
    const mockRepository = {
        state: {
            workingTreeChanges: [
                {
                    uri: { fsPath: '/mock/workspace/file1.ts' },
                    status: 1, // Status.INDEX_ADDED
                },
                {
                    uri: { fsPath: '/mock/workspace/file2.ts' },
                    status: 2 // Status.INDEX_DELETED
                }
            ],
            HEAD: {
                name: 'main',
                commit: 'abc123'
            }
        },
        diffWithHEAD: jest.fn(),
        add: jest.fn(),
        commit: jest.fn(),
        rootUri: {
            fsPath: '/mock/workspace'
        }
    };

    return {
        extensions: {
            getExtension: jest.fn().mockImplementation((id: string) => {
                if (id === 'vscode.git') {
                    return {
                        isActive: true,
                        exports: {
                            getAPI: (version: number) => ({
                                repositories: [mockRepository],
                                onDidChangeState: jest.fn(),
                                onDidOpenRepository: jest.fn(),
                                onDidCloseRepository: jest.fn()
                            })
                        },
                        activate: jest.fn().mockResolvedValue(undefined)
                    };
                }
                return undefined;
            })
        },
        workspace: {
            workspaceFolders: [{
                uri: {
                    fsPath: '/mock/workspace'
                },
                name: 'mock-workspace',
                index: 0
            }]
        },
        Uri: {
            file: jest.fn(path => ({ fsPath: path }))
        }
    };
});

describe('GitProvider', () => {
    let gitProvider: GitProvider;
    let mockRepository: any;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Get reference to mock repository for assertions
        mockRepository = (vscode.extensions.getExtension('vscode.git')?.exports?.getAPI(1) as GitAPI)
            .repositories[0];

        // Create new GitProvider instance
        gitProvider = new GitProvider();
        await gitProvider.Init;
    });

    describe('initialize', () => {
        it('should throw error if git extension not found', async () => {
            // Mock extension not found
            jest.spyOn(vscode.extensions, 'getExtension')
                .mockReturnValueOnce(undefined);

            const provider = new GitProvider();
            await expect(provider.Init).rejects.toThrow('Git extension not found');
        });

        it('should throw error if no workspace folder found', async () => {
            // Mock no workspace folders by temporarily modifying the mock
            const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
            (vscode.workspace as any).workspaceFolders = undefined;

            const provider = new GitProvider();
            await expect(provider.Init).rejects.toThrow('No workspace folder found');

            // Restore original mock
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        });

        it('should throw error if no repository found in workspace', async () => {
            // Mock git extension to return empty repositories array
            const mockApi = {
                repositories: [],
                onDidChangeState: jest.fn(),
                onDidOpenRepository: jest.fn(),
                onDidCloseRepository: jest.fn()
            };
            jest.spyOn(vscode.extensions, 'getExtension').mockReturnValueOnce({
                id: 'vscode.git',
                extensionUri: vscode.Uri.file('/mock/git/extension'),
                extensionPath: '/mock/git/extension',
                isActive: true,
                packageJSON: {},
                extensionKind: 1,  // Using numeric value for ExtensionKind
                exports: {
                    getAPI: () => mockApi
                },
                activate: jest.fn().mockResolvedValue(undefined)
            } as any as vscode.Extension<any>);

            const provider = new GitProvider();
            await expect(provider.Init).rejects.toThrow('No git repository found in workspace');
        });
    });

    describe('getDiff', () => {
        it('should get combined diff of all changes', async () => {
            // Mock diffWithHEAD responses
            mockRepository.diffWithHEAD
                .mockResolvedValueOnce('diff for file1')
                .mockResolvedValueOnce('diff for file2');

            const diff = await gitProvider.getDiff();

            expect(mockRepository.diffWithHEAD).toHaveBeenCalledTimes(2);
            expect(mockRepository.diffWithHEAD).toHaveBeenCalledWith('/mock/workspace/file1.ts');
            expect(mockRepository.diffWithHEAD).toHaveBeenCalledWith('/mock/workspace/file2.ts');
            expect(diff).toBe('diff for file1\ndiff for file2');
        });

        it('should handle untracked files', async () => {
            // Mock untracked file error
            mockRepository.diffWithHEAD
                .mockRejectedValueOnce(new Error('file1.ts not found in HEAD'))
                .mockResolvedValueOnce('diff for file2');

            const diff = await gitProvider.getDiff();

            expect(mockRepository.diffWithHEAD).toHaveBeenCalledTimes(2);
            // Empty string is pushed for untracked file, but only non-empty diffs are joined
            expect(diff).toBe('diff for file2');
        });

        it('should handle diff errors', async () => {
            // Mock console.error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Mock diff error
            mockRepository.diffWithHEAD
                .mockRejectedValueOnce(new Error('diff failed'))
                .mockResolvedValueOnce('diff for file2');

            const diff = await gitProvider.getDiff();

            expect(consoleSpy).toHaveBeenCalled();
            expect(diff).toBe('diff for file2');

            consoleSpy.mockRestore();
        });
    });

    describe('getStatus', () => {
        it('should return formatted status of all changes', async () => {
            const status = await gitProvider.getStatus();

            expect(status).toBe('INDEX_ADDED /mock/workspace/file1.ts\nINDEX_DELETED /mock/workspace/file2.ts');
        });
    });

    describe('stage', () => {
        it('should stage specified files', async () => {
            const paths = ['/mock/workspace/file1.ts', '/mock/workspace/file2.ts'];
            await gitProvider.stage(paths);

            expect(mockRepository.add).toHaveBeenCalledWith(paths);
        });

        it('should throw error if staging fails', async () => {
            mockRepository.add.mockRejectedValueOnce(new Error('staging failed'));

            const paths = ['/mock/workspace/file1.ts'];
            await expect(gitProvider.stage(paths))
                .rejects.toThrow('Failed to stage files: staging failed');
        });
    });

    describe('commit', () => {
        it('should commit with message', async () => {
            const message = 'test commit';
            await gitProvider.commit(message);

            expect(mockRepository.commit).toHaveBeenCalledWith(message, undefined);
        });

        it('should commit with options', async () => {
            const message = 'test commit';
            const options = { amend: true };
            await gitProvider.commit(message, options);

            expect(mockRepository.commit).toHaveBeenCalledWith(message, options);
        });

        it('should throw error if no message provided', async () => {
            await expect(gitProvider.commit(''))
                .rejects.toThrow('Commit message is required');
        });

        it('should allow empty message with amend option', async () => {
            await gitProvider.commit('', { amend: true });

            expect(mockRepository.commit).toHaveBeenCalledWith('', { amend: true });
        });

        it('should throw error if commit fails', async () => {
            mockRepository.commit.mockRejectedValueOnce(new Error('commit failed'));

            await expect(gitProvider.commit('test'))
                .rejects.toThrow('Failed to commit changes: commit failed');
        });
    });
});