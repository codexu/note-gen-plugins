# Iconize

Requires NoteGen **0.37.1 or later** and the plugin API declared in `plugin.json`.

[中文](README.md)

Assign built-in icons or Emoji to files and folders through the public NoteGen `fileIcons.setRules()` API. The file tree and editor tabs share the host resolver. No network requests or note-content access are used.

Supports context-menu assignments, exact paths, extensions, defaults, editing, disabling, deletion and drag ordering, with up to 100 rules. Precedence is assignment → exact path → extension → default, then first match within each group. No rules are installed initially. See [Usage](USAGE.md).

Workspace storage restores rules on activation. Host updates invalidate its bounded cache; stopping, disabling, failed activation and uninstall remove runtime rules. Optional `notes.list` permission enables observable note move/delete events; only file assignments with follow enabled are migrated or removed. Events and commands are serialized within an instance, and writes reload stored rules first.

## Contract limits

Requires protocol `^0.1.4`, supplied by the local SDK settings-view implementation. Manifest app minimum is 0.37.1; the actual installed host must include the new resource implementation.

- `PluginFileIconRule` accepts only kind, path, extension and icon. Icon accepts a name or Emoji, with no color field. **Custom icon tint is unavailable**; the UI explains this and suggests colored Emoji. No CSS injection or custom SVG packs are used.
- Paths are exact workspace-relative locations, with no globs, prefix matching or recursive inheritance. SDK path restrictions apply, including a 240-byte UTF-8 limit, 12 segments and reserved directories/file suffixes. Some existing paths cannot be assigned directly.
- Note events do not provide comprehensive folder/attachment/external filesystem identity tracking. Moves while disabled or outside permission coverage cannot be followed. Edit the target manually. Fixed path rules stay at their original location. A move outside the grant may appear as deletion; follow-enabled assignments are then removed without guessing hidden paths.
- Workspace storage has no public change subscription or compare-and-swap. Other open windows require Reload and apply or plugin restart. Avoid editing concurrently in multiple windows; last-writer overwrites remain possible. Providers are resolved in plugin-ID order, ahead of this plugin's internal priority.

## Development and integration

Reuses `shared/workbench.ts` for declarative UI, localization, workspace guards and error notices. Dev dependencies: `@notegen/plugin-api: workspace:^`, `@notegen/plugin-cli: workspace:^`, `typescript: ^5.8.3`; no third-party runtime dependencies. The existing workspace glob includes this directory.

When authorized, build with `pnpm --filter @notegen/plugin-iconize build`, then package with `pnpm --filter @notegen/plugin-iconize plugin:pack`. The SDK must already have new-protocol build artifacts. Its CLI includes both USAGE files automatically.

Shared integration remains: add root README entries, add a marketplace registry entry, and update the lockfile importer centrally. No root package dependency changes are needed. No shared files were modified, and nothing was committed, pushed or published.

The subsequent authorized local pass completed type checking, build, package validation and SDK in-memory smoke checks; see [local test record](TESTING.md). Desktop automation could not connect to the running development window. Actual runtime acceptance still needs to cover installation/lifecycle, tree-tab consistency, precedence, Emoji, move/permission boundaries, workspace switches during operations, multiple windows and packaged bilingual usage guides.
