# Daily Notes

[简体中文](README.md)

The official Daily Notes plugin for NoteGen. When its command runs, the plugin
resolves the logical date using the configured workspace time zone, then opens
an existing note or creates a new one.

- Plugin ID: `top.notegen.daily-notes`
- Version: `0.1.0`
- Platform: NoteGen Desktop
- Minimum NoteGen version: `0.37.0`

## Features

- Configurable daily-note folder and file name;
- either an inline body template or a Markdown template file from the workspace;
- idempotent open-or-create behavior for repeated runs on the same day;
- English and Simplified Chinese interface text.

Folder and file-name templates support `{{date}}`, `{{year}}`, `{{month}}`, and
`{{day}}`. Body templates also support `{{dateLong}}`, `{{weekday}}`, `{{time}}`,
`{{title}}`, `{{path}}`, and `{{workspaceName}}`.

## Permissions

| Permission | Purpose |
| --- | --- |
| `notes.create` | Create the daily note in the configured workspace folder |
| `notes.open` | Open the newly created or existing daily note |
| `notes.read` (optional) | Read the Markdown template file selected in settings |

On first enablement, enter an approved base folder for `notes.create` and
`notes.open`. Use `Daily` with the default settings; year and month folders are
created below it. `.` grants the whole workspace and should be avoided unless
necessary. If you select a template file, grant only that file to `notes.read`.

Changing the folder or template-file setting does not rewrite existing grants.
If the new path falls outside the current grant, the operation is denied. Review
the path again on NoteGen's plugin Permissions page and manually revoke grants
you no longer need.

The plugin does not access the network. All content stays in the active NoteGen
workspace.

## Development

After installing dependencies from the repository root, run:

```bash
pnpm --filter @notegen/plugin-daily-notes build
pnpm --filter @notegen/plugin-daily-notes validate
pnpm --filter @notegen/plugin-daily-notes run plugin:pack
```

Development output is written to `.notegen/package`, and the unsigned archive
is written to `.notegen/releases`. The marketplace does not yet publish a
signed index, so the presence of this source does not make the plugin available
for installation from NoteGen.

## Interface visibility

In NoteGen versions that support display preferences, open Settings → Plugins → Installed → this plugin’s settings → Interface visibility. You can independently control the file context menu, tab context menu, and slash command menu. Entries are shown by default. Changes apply immediately and are saved for all workspaces on this device.

Hiding an entry keeps the plugin and its data. Commands remain available in the command palette. Hidden sidebar or editor views are not reopened automatically; enable the corresponding display option to see them again.
