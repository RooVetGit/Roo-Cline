# Setting Up Conversation Save Folder

## Overview

The conversation save folder feature allows you to automatically save all conversations to a local folder. Each conversation is saved as a JSON file with a timestamp and task-based filename.

## Project-Specific Setup

1. Open your project in VSCode
2. Open Command Palette (Cmd/Ctrl + Shift + P)
3. Type "Preferences: Open Workspace Settings (JSON)"
4. Add the following to your workspace settings:

```json
{
	"cline.conversationSaveFolder": "./conversations"
}
```

Replace `./conversations` with your preferred path. You can use:

- Relative paths (e.g., `./conversations`, `../logs`)
- Absolute paths (e.g., `/Users/name/Documents/conversations`)

The folder will be created automatically if it doesn't exist.

## Disabling Conversation Saving

To disable conversation saving, either:

- Remove the `cline.conversationSaveFolder` setting
- Set it to an empty string: `"cline.conversationSaveFolder": ""`

## File Structure

Each conversation is saved as a JSON file with:

- Filename format: `{timestamp}-{task-text}.json`
- Files are updated automatically as conversations progress
- Each file contains the complete conversation history

Example file structure:

```
your-project/
  conversations/
    2025-01-20T12-00-00-Create-todo-app.json
    2025-01-20T14-30-00-Fix-bug-in-login.json
```
