# Terminal

An official NoteGen desktop plugin. Open an interactive shell in a dedicated editor tab, starting in the current workspace. It can run Claude Code or other locally installed command-line tools. The plugin bundles its terminal UI and xterm; NoteGen supplies only the permission-checked PTY session bridge.

Requires NoteGen 0.38.0 or later with the terminal host capability. Enabling the plugin requires the `terminal.open` permission. Shell commands run with the current user's full system access, including files outside the NoteGen workspace.

For local development, run `pnpm dev:terminal` from the repository root. It watches the linked SDK and plugin source, then updates the importable package automatically.

Closing the tab, changing workspaces, or disabling the plugin ends the process. Sessions are not restored after restarting NoteGen. See the [usage guide](USAGE.md). [中文](README.md)
