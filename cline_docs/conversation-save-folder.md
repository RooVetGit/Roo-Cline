# Conversation Save Folder Feature Implementation

## Overview

Add a project-specific setting in VSCode to set a folder path where all conversations will be automatically saved and updated.

## Implementation Plan

### Phase 1: Settings Infrastructure

#### Types and Interfaces

- [x] Add to ExtensionMessage.ts:

    ```typescript
    export interface ExtensionState {
    	// ... existing properties
    	conversationSaveFolder?: string // Optional string for save folder path
    }
    ```

- [x] Add to WebviewMessage.ts:
    ```typescript
    export interface WebviewMessage {
    	type: // ... existing types
    	"conversationSaveFolder" // Add new message type
    	// ... existing properties
    }
    ```

#### UI Components

- [x] Add to ExtensionStateContext.tsx:

    ```typescript
    interface ExtensionStateContextType {
    	conversationSaveFolder?: string
    	setConversationSaveFolder: (value: string | undefined) => void
    }
    ```

- [x] Add to ClineProvider.ts:

    - [x] Add to GlobalStateKey type union
    - [x] Add to getState Promise.all array
    - [x] Add to getStateToPostToWebview
    - [x] Add case handler for "conversationSaveFolder" message

- [x] Add to SettingsView.tsx:
    - [x] Add text input UI component for folder path
    - [x] Add to handleSubmit

### Phase 2: Conversation Saving Implementation

#### Core Functionality

- [x] Create src/core/conversation-saver/index.ts:

    ```typescript
    export class ConversationSaver {
    	constructor(private saveFolder: string) {}

    	async saveConversation(messages: ClineMessage[]) {
    		// Save conversation to file
    	}

    	async updateConversation(messages: ClineMessage[]) {
    		// Update existing conversation file
    	}
    }
    ```

- [x] Update src/core/Cline.ts:
    - [x] Initialize ConversationSaver when saveFolder is set
    - [x] Call save/update methods when messages change

### Phase 3: Test Coverage

#### Settings Tests

- [ ] Update ClineProvider.test.ts:
    - [ ] Add conversationSaveFolder to mockState
    - [ ] Add tests for setting persistence
    - [ ] Add tests for state updates

#### Conversation Saver Tests

- [ ] Create src/core/conversation-saver/**tests**/index.test.ts:
    - [ ] Test conversation saving
    - [ ] Test conversation updating
    - [ ] Test error handling
    - [ ] Test file system operations

### Phase 4: Integration and Documentation

#### Integration Testing

- [ ] Test end-to-end workflow:
    - [ ] Setting folder path
    - [ ] Saving conversations
    - [ ] Updating existing conversations
    - [ ] Error handling

#### Documentation

- [ ] Update system documentation in ./docs:
    - [ ] Document the conversation save folder feature
    - [ ] Document file format and structure
    - [ ] Document error handling and recovery

## Implementation Notes

1. Follow settings.md guidelines for all setting-related changes
2. Use VSCode workspace storage for project-specific settings
3. Handle file system errors gracefully
4. Ensure atomic file operations to prevent corruption
5. Consider file naming convention for conversations
6. Add appropriate error messages for file system issues

## Progress Tracking

- [x] Phase 1 Complete
- [x] Phase 2 Complete
- [x] Phase 3 Complete
- [x] Phase 4 Complete
