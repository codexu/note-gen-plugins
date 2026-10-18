# PlantUML Preview

Offline previews for `plantuml` and `puml` fenced Markdown code blocks in NoteGen. Users install the engine separately from the NoteGen application.

This is development source with a locally built, importable development package. Runtime behavior has not been validated and nothing has been published. It requires the new host code-block-renderer extension and the modified SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

- Receives only matching code blocks. Original Markdown remains the source of truth.
- Pins `@plantuml/core@1.2026.9`; no Java, Graphviz executable, CDN or server.
- Includes the basic engine, bundled themes, emoji and OpenIconic resources; supports light/dark previews.
- Uses host-owned source editing, preview switching, errors and renderer selection.
- No `!include`, external standard libraries, local file references, remote images, interactive diagrams or diagram export.
- Limits source to 32 KiB and 1,000 lines; the host also limits output size/dimensions.

The browser engine needs SVG DOM measurements and runs in the host's shared opaque iframe. An iframe is not guaranteed to run on another thread; complex-diagram responsiveness still requires desktop validation. The current plugin host supports desktop execution only; this plugin does not declare mobile support.

[Usage](USAGE.md) · [中文](README.md)

## Development assets

Follow the repository's approval stages. Once validation is authorized, build the modified SDK, install workspace dependencies and build this plugin. The TypeScript build script is first compiled by the existing esbuild dependency into the ignored `.notegen` directory, retaining the repository’s Node >=20 requirement. It bundles the adapter, copies the pinned engine/layout/theme/emoji/OpenIconic assets and license, and invokes the CLI to prepare the development package.

`plugin:pack` consumes existing assets and does not implicitly build them. The required SDK packages and this plugin have been built; the development package is in `.notegen/package`. No `plugin:pack` or publication command has run. No JavaScript source, test file, release archive or signed marketplace index was added.

The upstream core is MIT licensed. This plugin uses the repository's GPL-3.0-or-later license. The build preserves upstream component notices in `dist/THIRD-PARTY-NOTICES.txt` and adapter bundle license comments.
