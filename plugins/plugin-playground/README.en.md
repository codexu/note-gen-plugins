# Plugin Playground

Version `0.1.1` adds **Run the full demo**: prepare fixtures, run all 32 capability examples, and open both sidebars, a tab and an interactive dialog with one action. Individual probes remain available in an expandable form. Permission and platform limits are reported per operation; automatic editor examples only modify this session's fixture notes.

[简体中文](README.md) · [Usage and manual acceptance guide](USAGE.md)

An official interactive reference for the current public NoteGen plugin API. The implementation follows `.sdk/packages/plugin-api/src/index.ts` and the host broker/UI constraints without importing host internals or using DOM, Node.js, filesystem or direct network APIs.

## Source map

- `src/main.ts`: lifecycle, command registration, serialized dispatch, UI, forms and event subscriptions.
- `src/operations.ts`: 32 runnable examples, session-owned fixtures, pagination and revision protection.
- `plugin.json`: all 12 optional permissions, four activation categories, menus, six setting types, status bar and three view locations.
- `locales/`: English and Simplified Chinese manifest/runtime strings.
- `USAGE*.md`: packaged offline instructions and manual acceptance checks.

## API coverage

| API / contribution | Example |
| --- | --- |
| Plugin metadata, i18n and interpolation | Environment operation |
| Activate/deactivate, abort signal and disposable cleanup | Lifecycle and cancellation handling |
| Command registration, JSON arguments/results | Buttons, forms, table cells, trees and intentional exception command |
| Host command execution | Search, settings and plugin settings navigation |
| Workspace information/change | Environment and workspace events |
| Calendar | Time zone setting, 04:00 logical day and invalid-zone probe |
| Notes open/create/read/list/search/write/move/delete | Fixture workflow, cursor pagination, revision-protected writes and stale revision probe |
| Attachment create/read | Unique TXT fixture and Base64 response |
| Editor state/selection/snapshot | Sidebar reader |
| Editor applyEdit/applyEdits/setSelection | Cursor/selection replacement, source mode atomic edits and UTF-16 selection |
| Device/workspace storage get/set/delete | Persist/read/delete sample JSON |
| Settings get/change | Boolean/string/number/select/workspace-file/workspace-folder and both scopes |
| Notice and status bar | Visibility, busy state, compact text and accessibility label |
| View update/open/close/focus/getState/change | Left/right sidebars and editor tab |
| Dialog open/update/replace/close/close event | Interactive validation dialog |
| All 11 UI block types | Heading, text, list, key-value, actions, form, separator, callout, progress, table, tree |
| Forms | Five field types, required/disabled/conditional fields, field errors, messages, resetKey, changeCommand and expectedForm |
| Network fetch | Fixed public HTTPS GET with timeout, headers, response status/headers/body |
| Event subscriptions | Workspace, notes, active editor/content, settings, view and dialog |
| Activation | onCommand, onEditor:markdown, onWorkspace:open, onNotes:change |
| Menu contributions | Slash, editor context, file context and mobile writing overflow |
| Permissions | All 12 public permissions declared optional for individual grant/denial checks |

Coverage refers to public runtime interfaces and contribution categories, not every parameter value, permission-scope combination or host implementation detail. Network uses GET only. Permissions target the active editor, fixture folder and network origin.

## Building and packaging

From the workspace root with SDK dependencies installed:

```bash
pnpm --filter @notegen/plugin-playground build
pnpm --filter @notegen/plugin-playground validate
pnpm --filter @notegen/plugin-playground plugin:pack
```

Development output goes to `.notegen/package`. Signing and publishing use the repository workflow. The plugin is registered as official and non-featured; source registration is not marketplace publication.

The plugin build (including TypeScript checks), generated package validation and manifest compatibility checks against NoteGen 0.37.0 have passed. The development package includes both usage guides. Automated regression tests for denied permissions, fixture mutations and dialog validation have passed. Lint and live host import have not been run. Follow the usage guide for manual acceptance. The counter is not an automated regression suite; package trust, compatibility, quota and watchdog tests belong in SDK/host suites.
