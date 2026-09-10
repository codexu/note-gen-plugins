# Editor Statistics

[简体中文](README.md)

The official Editor Statistics plugin for NoteGen. It parses snapshots from the
active Markdown editor locally and shows character count, word count, and
estimated reading time in the status bar.

- Plugin ID: `top.notegen.editor-statistics`
- Version: `0.1.0`
- Platform: NoteGen Desktop
- Minimum NoteGen version: `0.37.0`

## Features

- Character counts with and without whitespace;
- separate CJK-character and non-CJK-word counts;
- reading-time estimates at 300 CJK characters or 200 non-CJK words per minute;
- Markdown-aware extraction with an option to include code blocks;
- event-driven updates, with manual refresh for very large documents;
- English and Simplified Chinese interface text.

URLs, math, front matter, and task-list markers are excluded from readable-text
statistics. All calculations run inside the plugin environment, and content is
never sent over the network.

## Permissions

| Permission | Purpose |
| --- | --- |
| `editor.read` | Read a text snapshot from the active Markdown editor |

## Development

After installing dependencies from the repository root, run:

```bash
pnpm --filter @notegen/plugin-editor-statistics build
pnpm --filter @notegen/plugin-editor-statistics validate
pnpm --filter @notegen/plugin-editor-statistics run plugin:pack
```

`@notegen/plugin-cli` bundles `markdown-it` into the self-contained entry file.
At runtime, the plugin accesses NoteGen only through the public
`@notegen/plugin-api` contract. The marketplace does not yet publish a signed
index, so the presence of this source does not make the plugin available for
installation from NoteGen.

## Interface visibility

In NoteGen versions that support display preferences, open Settings → Plugins → Installed → this plugin’s settings → Interface visibility. You can independently control the status bar. Entries are shown by default. Changes apply immediately and are saved for all workspaces on this device.

Hiding an entry keeps the plugin and its data. Commands remain available in the command palette. Hidden sidebar or editor views are not reopened automatically; enable the corresponding display option to see them again.

The existing workspace-level “Show in status bar” setting remains supported. The status bar appears only when both that setting and the device display option are enabled. Refresh and details commands remain available.
