# Dynamic Templates (official plugin)

Requires NoteGen **0.37.1 or later** and the plugin API declared in `plugin.json`.

[中文](README.md) · [Usage](USAGE.md)

Markdown templates with recursive folder discovery, date/time/title/selection variables, custom field forms, preview confirmation, insertion and note creation. Includes English and Chinese meeting minutes, daily reports and reading notes. v1 uses its own syntax; it does not implement Obsidian APIs or execute system commands.

Insertion uses public `editor.applyEdits` with a captured position and revision in source mode, preserving selected text. Creation uses `notes.openOrCreate` without overwriting existing files. Dialog closure, workspace changes and stale submissions invalidate pending work. Already-dispatched host writes cannot be cancelled; see the usage guide.

## Development

- ID `top.notegen.templates`, version `0.1.0`, API `^0.1.4`, desktop.
- Reuses `record`, `string` and `notePath` from repository `shared/workbench.ts`; dialog sessions implement cancellation and guarded submission locally.
- Dev dependencies: workspace `@notegen/plugin-api`, `@notegen/plugin-cli`, TypeScript `^5.8.3`. No added runtime dependency.
- Built-in sources live in `templates/**/*.md`. `scripts/sync-templates.mjs` generates tracked `src/bundled.ts`; build and pack scripts synchronize these before SDK bundling. The SDK includes USAGE files and locales in the package.
- Static review only. Tests, lint, type checks, builds and installation were not run for this change.

When authorized, run from the workspace root:

```sh
pnpm --filter @notegen/plugin-templates build
pnpm --filter @notegen/plugin-templates validate
pnpm --filter @notegen/plugin-templates plugin:pack
```

## Integration

Changes are confined to `plugins/templates`. The existing `plugins/*` workspace glob covers the package. Integrate the lockfile importer, root README index and marketplace registry centrally, then build/validate/package when authorized. Source files are not release artifacts.

Public API limits: fixed range edits require source mode; the manifest allows one folder-permission setting binding. This plugin binds the output folder, while template read/list grants are configured in the authorization UI. Implemented functionality needs no SDK or host changes.

## Template creator update

The dedicated settings page now explains both customization methods and offers Create template, also available from the chooser. The wizard configures fields through forms and generates a Markdown file; hand-written templates remain supported. It uses optional notes.write scoped to the template folder and sends create-only requests. Tests and builds were not run for this update; rebuild the development import package to include it.
