# Plugin Playground

Plugin Playground (`top.notegen.plugin-playground`) is an official manual testing and development reference plugin. It includes 32 runnable operations plus menu, view, form, dialog and event examples.

## Getting started

1. Open **Plugin Playground** from the command palette, the Lab status item, editor slash/context menu, file context menu or mobile writing overflow menu.
2. Choose a test folder in plugin settings (default: `PluginPlayground`). Grant the needed note and attachment permissions for that folder, editor permissions for the active editor, and network permission for `https://notegen.top`. Choosing a folder does not grant permission.
3. Select an operation, enter text and a result limit, then run it. Operations marked ⚠ require the consent checkbox. Deletion also requires entering `DELETE`.
4. Inspect the returned result or host error. The coverage table records the latest success/failure for each operation. Refresh to see new events.

All permissions are optional. UI, calendar, storage and settings examples remain usable without file/editor/network grants. Restricted calls report `PermissionDenied`. Grant changes may restart the plugin, requiring new fixture files.

## Suggested manual checks

- **Basics:** inspect plugin/workspace/i18n information, calendar, and all six setting types. Save, read and delete both storage areas. Restart to check persistence; switch workspaces to compare device storage with workspace storage.
- **Notes:** create a fixture, read, append, verify stale revision protection, move and open it. Close every tab, pane and separate window referencing it before any later write, move or delete. The separate write/create operation demonstrates creation through `notes.write`.
- **Listing/search:** create several fixtures, set the page limit to 1, list recursively and request subsequent pages. Search for a phrase in saved content. No next page produces an explicit message. Search only includes saved Markdown.
- **Attachments:** create a TXT fixture and read its path, byte count and Base64. Content is fixed to `NoteGen Plugin Playground` followed by a newline.
- **Editor:** open a left or right sidebar using the tree at the bottom of the main panel. Run editor operations from that sidebar while a Markdown note is active. Read the snapshot/selection, insert at the cursor and replace the selection. Switch to source mode for atomic edits at the beginning/end and UTF-16 selection offsets. Editor mutations affect the active note; use the host's undo to restore it.
- **Network:** manually run the HTTPS GET example. It visits only `https://notegen.top/`, sends no note text, form values or credentials, and shows status, headers and the first 1500 body characters. HTTP 4xx/5xx can still represent a completed network invocation; inspect the status separately.
- **UI:** try notices, visible/hidden/busy status states, dialog validation/update/replacement/programmatic close, view open/focus/state/close, and all three host navigation commands.

Each creation uses a new path. Only notes successfully created by this session become owned fixtures. Append/move/delete affect only the current fixture. The optional sample file setting affects reads only. Restarting or switching workspaces never adopts old fixture files.

## Forms and events

The main panel and both sidebars have separate forms. They demonstrate text, textarea, number, select, checkbox, conditional and disabled fields. Deletion confirmation appears only for deletion. Debounced changes use `expectedForm` to reject stale responses. Reset uses `resetKey` to clear values and feedback.

The dialog requires a name of at least two characters and shows field-level validation errors. A checkbox reveals an optional body. Hidden and disabled fields are omitted from submission. Valid submission closes the dialog and displays values. Updating keeps form state where supported by the host; replacement creates a new interaction instance.

Events cover settings, workspace, notes, active editor, editor content, view visibility, dialog close reasons, form changes and activation. Logs are bounded and kept in memory, without persisting editor text. Refresh explicitly to inspect changes. Disabling disposes subscriptions. Workspace changes clear prior results, fixture paths and pagination state.

## Errors and platform behavior

| Scenario | Expected behavior |
| --- | --- |
| Missing permission | `PermissionDenied`; other examples stay usable |
| Target open in an editor | Write/move/delete return `EditorBusy` |
| Stale revision probe | Append a revision marker, require `StaleRevision` for the old revision, verify content/revision remain unchanged after rejection |
| Invalid time zone probe | Succeeds only after observing `InvalidTimeZone` |
| Invalid path probe | Reading `../outside.md` must return `InvalidPath`; missing permission may be rejected first |
| Batch edit/selection outside source mode | Prompt to use source mode |
| Mobile or unsupported host surface | May return `UnavailableOnPlatform`; some sidebars may not appear |
| Intentional exception | Run the clearly labelled throw command in the command palette; inspect host error reporting and whether later commands still work |

The manifest declares desktop, iOS and Android to support capability comparison. This does not imply every operation is supported on every platform. Deletion currently uses desktop system trash. Host policies govern separate windows, read-only files, quotas, network failures and timeouts. Actual device verification is still required.

The success count describes only these 32 operations in the current session. Package signatures, integrity, install/update compatibility, worker isolation, watchdogs and quota enforcement require dedicated SDK/host testing. A loaded ordinary plugin cannot fully verify them. This example does not automatically start infinite loops or exhaust quotas.

## Cleanup

Clear history clears results and coverage, not files. Delete sample storage keys removes only this plugin's `sample` key from both storage areas. Delete fixture removes only the current note. Other generated files remain available for inspection; remove them manually using the file manager. The public attachment API has no delete operation.
