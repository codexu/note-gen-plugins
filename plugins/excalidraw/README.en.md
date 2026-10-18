# Excalidraw Preview

Preview Excalidraw JSON scenes as static offline diagrams.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses official @excalidraw/utils to export complete Excalidraw JSON scenes, previewing rectangles, ellipses, diamonds, lines, arrows, freehand strokes and text. No canvas editing, images/attachments, embeddables, links, frames or scene migration. Limits: 400 elements and 5,000 points per array; input remains limited to 32 KiB. Provide full exported element properties and seeds. Text uses a system sans-serif font, so handwritten fonts and line wrapping may differ from the official editor. The large upstream export module is compressed into four asset chunks at build time and decompressed on first use, requiring a modern desktop WebView with DecompressionStream. The development package is about 13.3 MiB and the decompressed engine script about 19 MiB. In-app cold-start cost and runtime memory remain unmeasured.

[Usage](USAGE.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-excalidraw build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
