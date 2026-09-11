# Korean Language Pack

Requires NoteGen **0.37.1 or later** and the plugin API declared in `plugin.json`.

[简体中文](README.md) · [한국어 사용 안내](USAGE.ko.md)

An independent official NoteGen language pack. Enabling it adds **한국어** to the interface language selector. All built-in languages remain available. This package supplies Korean only.

- ID: `top.notegen.language-pack-ko`
- Workspace package: `@notegen/plugin-language-pack-ko`
- Display name: `Korean Language Pack · 한국어`
- Locale: `ko`; version: `0.1.0`
- Platform: desktop; NoteGen `0.37.1` or later **with resource protocol `0.1.2` implemented**. The application version alone does not guarantee support in older builds.

## Use

Install and enable the package in the current workspace, then select **한국어** under Settings → General Settings → Interface Settings → Language. See the bundled [English](USAGE.md), [Chinese](USAGE.zh-CN.md), and [Korean](USAGE.ko.md) guides.

This is source code, not a published marketplace release. It has not been built, packaged, signed, or published. Developer import requires building with the current SDK, enabling Developer Mode, and importing this directory’s `.notegen/package` output.

## Coverage

`messages/ko.json` follows the host’s nested message tree, including `common`. It covers settings, plugins, records, AI chat, sync, search, knowledge management, canvases, files, editors, windows, and common actions. The host’s mobile message keys are included for structural completeness; resource registration currently supports desktop only.

The baseline contains 4,227 string leaves. The pack supplies 4,225 baseline fields plus the language-plugin discovery entry, for 4,226 total. Two untranslated Mermaid ER code examples intentionally fall back to the host: `settings.editor.mermaid.templates.er` and `editor.mermaid.templates.er`. Their Chinese baseline contains literal `o{`, which the current host ICU parser rejects as a malformed argument. Escaping only the Korean value cannot fix the host’s validation of the original value. Other code examples retain their syntax; product names, paths, commands, and technical identifiers remain literal.

[translation-baseline.json](translation-baseline.json) records source fingerprints and fallback keys. The image-save message retains the host’s literal `__PATH__` replacement marker instead of the English source’s incompatible ICU `{path}`.

Argument names, ICU plural branches, `#`, line breaks, and quoted literal placeholders are preserved. Korean uses the same count expression in the retained `one` and `other` branches. Local machine translation assisted drafting; common UI terms, argument-bearing messages, and technical examples received editorial corrections. Native Korean review in the real interface is still needed. Complete key coverage does not imply line-by-line human or runtime acceptance.

## Contract and lifecycle

The manifest declares only `resources.languages`. It has no JavaScript entry, runtime contributions, activation events, permissions, or runtime dependencies. The host reads integrity-protected JSON during installation/enablement and unregisters it on disable/uninstall. No host files or private modules are used.

Selecting Korean reloads messages through the host. Missing/new keys fall back to built-in Simplified Chinese. Removing the provider removes its language choice; with no other Korean provider, the host displays its built-in default while preserving the saved `ko` preference for re-enablement. Built-in Chinese, English, Japanese, Portuguese, Traditional Chinese, and German remain available. For overlapping providers, the lexically earlier plugin ID wins for matching keys.

An independent override pack can target an existing locale, for example:

```json
{
  "resources": {
    "languages": [
      { "locale": "en", "name": "English", "messages": "messages/en.json" }
    ]
  }
}
```

The referenced file may contain `{"common":{"save":"Save changes"}}`. Missing messages then fall back to built-in English and finally Chinese; removing the provider restores built-in messages. This example is documentation only: the Korean pack does not override any built-in locale. Manifest `defaultLocale/locales` localize a plugin’s own contributions and are distinct from host language resources.

## Naming convention

Use one installable package per language, with `language-pack-<locale-slug>` consistently:

| Field | Convention | Korean |
| --- | --- | --- |
| Locale | Standard BCP 47 casing | `ko` |
| Slug | Lowercase locale, preserving hyphens | `ko` (region example: `pt-br`) |
| Plugin ID | `top.notegen.language-pack-<slug>` | `top.notegen.language-pack-ko` |
| Workspace package | `@notegen/plugin-language-pack-<slug>` | `@notegen/plugin-language-pack-ko` |
| Display name | `<English name> Language Pack · <native name>` | `Korean Language Pack · 한국어` |
| Selector label | Native language name | `한국어` |
| Resource | `messages/<BCP47>.json` | `messages/ko.json` |

Each language uses its own source directory, `plugins/language-pack-<slug>`. Korean lives in `plugins/language-pack-ko`. A future French pack would live in `plugins/language-pack-fr` with ID `top.notegen.language-pack-fr`. Each language is built, installed, enabled, and uninstalled independently.

## Development and integration

Only `@notegen/plugin-cli: workspace:^` is needed for development. Current SDK CLI `0.1.3` source supports entryless resource packs. There is no runtime library dependency. After workspace dependency installation, the available commands are:

```bash
pnpm --filter @notegen/plugin-language-pack-ko build
pnpm --filter @notegen/plugin-language-pack-ko validate
pnpm --filter @notegen/plugin-language-pack-ko run plugin:pack
```

The CLI includes referenced messages and `USAGE*.md` in the integrity-protected package. None of these commands, tests, lint, type checks, or host interaction checks were run during this task. Review was limited to source contracts and translation data.

Shared integration remains: add the workspace importer to `pnpm-lock.yaml`, list the plugin in the root bilingual READMEs, and register it in `market/registry.json` using repository conventions. The existing `plugins/*` workspace glob already includes this directory. Before release, build/package and exercise install, enable, language selection, restart restoration, missing-key fallback, disable, uninstall, and re-enable.
