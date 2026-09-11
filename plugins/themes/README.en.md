# NoteGen Themes

Requires NoteGen **0.37.1 or later** and the plugin API declared in `plugin.json`.

[中文](./README.md) · [Usage](./USAGE.md)

A declarative pack containing three original themes, each with a complete light and dark palette. It uses the SDK's `resources.themes` contract and the host's theme selection and lifecycle support, without duplicating the custom theme editor or built-in presets.

| Theme ID | Display name | Palette |
| --- | --- | --- |
| `paper-ink` | 纸墨 · Paper & Ink | Warm paper, brown primary; warm charcoal in dark mode |
| `pine` | 松林 · Pine | Gray-green surfaces, pine primary; deep green-gray in dark mode |
| `sea-mist` | 海岚 · Sea Mist | Cool gray surfaces, blue primary; deep blue-gray in dark mode |

All six palettes define the 16 supported HSL tokens. Light palettes pair dark primary buttons with light text; dark palettes use light primary buttons with dark text. Muted text and hover surfaces have dedicated colors. No JavaScript entry, runtime dependencies, permissions, arbitrary CSS, external fonts, or remote assets are included.

Plugin ID: `top.notegen.themes`; version: `0.1.0`; minimum desktop app version: `0.37.1`; plugin API: `^0.1.2`. Resource names are translated by the plugin locale files and follow the interface language in NoteGen clients that support localized resource names. English and Chinese USAGE files are automatically included by the CLI.

## Development and packaging

After installing workspace dependencies, run these commands from the repository root when needed:

```sh
pnpm --filter @notegen/plugin-themes validate
pnpm --filter @notegen/plugin-themes build
pnpm --filter @notegen/plugin-themes plugin:pack
```

Build output: `plugins/themes/.notegen/package`. Import its absolute path through the host's Developer page. Packing also builds and writes `plugins/themes/.notegen/releases/top.notegen.themes-0.1.0.unsigned.notegen-plugin`. This is an unsigned development artifact; marketplace distribution uses the repository's shared signing and release process.

The only development dependency is `@notegen/plugin-cli` (`workspace:^0.1.3`), from `.sdk` pointing to `/Users/xu/code/note-gen-plugin-sdk`. There is no TypeScript source or runtime API dependency.

## Contract and verification status

The implementation follows `PluginThemeResource`, `PLUGIN_THEME_TOKENS`, the SDK resource-pack example, and the CLI's entry-free packaging path. The host registers and removes resources, selects themes by `plugin ID:theme ID`, and merges host defaults → package palette → user overrides. Disabling or uninstalling removes resources without deleting user overrides or the host's remembered selection. See the bundled usage guide for recovery steps.

Only source reading and static review were performed. Tests, lint, type checks, builds, and packaging were not run, as requested. No installable artifact was generated in this task. Installation, host rendering, switching, re-enabling, and uninstall behavior remain unverified. Once verification is authorized, cover all three themes in both modes, system appearance, user overrides and reset, fallback on disable, and restoration on re-enable.

## Shared integration needed

Changes are confined to `plugins/themes`. The existing `plugins/*` workspace pattern already includes this package; no root package.json or workspace configuration changes are needed. Update the lockfile importer, register this directory and localized copy in market/registry.json, then generate and sign release artifacts through the shared release process. Suggested English marketplace description: “Three paired light/dark themes that respect your custom colors.” The root English and Chinese plugin lists can also include this pack.
