# Daily Notes

Keep today's plans, quick thoughts, and reflections in one note.

## Get started

1. Enable the plugin and approve its storage folder, `Daily` by default.
2. Click the daily-note button in the notes pane, or the action below this guide.
3. The plugin creates today's note if needed. Existing notes are opened without overwriting their contents.

The default path is `Daily/year/month/date.md`, for example `Daily/2026/09/2026-09-09.md`.
The same command is available in the plugin command palette.

## Customize

Plugin settings let you change the folder, filename, body template, and time zone.
Date variables include `{{year}}`, `{{month}}`, `{{day}}`, and `{{date}}`.
The default time zone follows your system; you can specify a zone such as `Asia/Shanghai`.

Templates apply only when a note is created. A template file is optional and requires separate read permission.
Without one, the plugin uses the configured body template.

## Troubleshooting

- Notes are created when you run the command, not automatically every day.
- After changing the folder, review its create/open permissions in plugin settings. Existing notes are not moved automatically.
- If the button is missing, enable the plugin in the current workspace. Rebuild and reimport development plugins after changing their contributions.
- The plugin requests no network access. Your normal NoteGen sync settings still apply to its notes.
