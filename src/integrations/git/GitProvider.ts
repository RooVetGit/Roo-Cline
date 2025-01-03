import { extensions, Uri, workspace } from 'vscode';
import { API as GitAPI, Change, Repository, Status } from '../../@types/vscode.git';

export class GitProvider {
    private repository: Repository | undefined;
    private gitExtension: GitAPI | undefined;
    public Init: Promise<void>;

    constructor() {
        this.Init = this.initialize()
    }

    /**
     * Initializes the git extension and repository
     */
    private async initialize(): Promise<void> {
        const extension = extensions.getExtension('vscode.git');
        if (!extension) {
            throw new Error('Git extension not found');
        }

        await extension.activate();
        if (!extension.exports?.getAPI) {
            throw new Error('Git extension API not found');
        }

        // We can safely assert the type here since we've checked for existence
        const git = extension.exports.getAPI(1) as GitAPI;
        this.gitExtension = git;

        // Get repository for current workspace
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            throw new Error('No workspace folder found');
        }

        const repo = this.gitExtension.repositories.find((repo: Repository) =>
            repo.rootUri.fsPath === workspaceFolders[0].uri.fsPath
        );

        if (!repo) {
            throw new Error('No git repository found in workspace');
        }

        this.repository = repo;
    }

    /**
     * Gets the diff of all changes in the working tree
     * @returns Combined diff string of all changes
     */
    async getDiff(): Promise<string> {
        await this.Init;

        if (!this.repository) {
            throw new Error('Repository not initialized');
        }

        const changes = this.repository.state.workingTreeChanges
        const diffs: string[] = [];

        for (const change of changes) {
            try {
                let diff: string;
                try {
                    diff = await this.repository.diffWithHEAD(change.uri.fsPath);
                } catch (e: any) {
                    // Handle case where file is untracked/new
                    if (e.message?.includes('not found in HEAD')) {
                        diff = '';
                    } else {
                        throw e;
                    }
                }

                if (diff) {
                    diffs.push(diff.toString());
                }
            } catch (err) {
                console.error(`Error getting diff for ${change.uri.fsPath}:`, err);
                // Continue with other files even if one fails
                continue;
            }
        }

        return diffs.join('\n');
    }

    /**
     * Gets the status of the git repository
     * @returns Array of file statuses
     */
    async getStatus(): Promise<string> {
        await this.Init;

        if (!this.repository) {
            throw new Error('Repository not initialized');
        }

        const changes = this.repository.state.workingTreeChanges;
        return changes.map((change: Change) =>
            `${Status[change.status]} ${change.uri.fsPath}`
        ).join('\n');
    }

    /**
     * Stages specified files in the git repository
     * @param paths Array of file paths to stage
     * @throws Error if repository is not initialized or if staging fails
     */
    async stage(paths: string[]): Promise<void> {
        await this.Init;

        if (!this.repository) {
            throw new Error('Repository not initialized');
        }

        try {
            await this.repository.add(paths);
        } catch (error) {
            console.error('Error staging files:', error);
            throw new Error(`Failed to stage files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Commits staged changes with the specified message
     * @param message Commit message
     * @param options Optional commit options (amend, signoff, etc.)
     * @throws Error if repository is not initialized or if commit fails
     */
    async commit(message: string, options?: {
        all?: boolean | 'tracked';
        amend?: boolean;
        signoff?: boolean;
        signCommit?: boolean;
        empty?: boolean;
        noVerify?: boolean;
        requireUserConfig?: boolean;
        useEditor?: boolean;
        verbose?: boolean;
        postCommitCommand?: string | null;
    }): Promise<void> {
        await this.Init;

        if (!this.repository) {
            throw new Error('Repository not initialized');
        }

        if (!message && !options?.amend) {
            throw new Error('Commit message is required');
        }

        try {
            await this.repository.commit(message, options);
        } catch (error) {
            console.error('Error committing changes:', error);
            throw new Error(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}