# D2 Preview

D2 describes architecture, flows and component relationships as text. This plugin previews `d2` fenced blocks offline in the editor.

Requires the desktop host with the generic code-block renderer API and the local SDK/CLI. An approved build generates `.notegen/package`; manual in-app validation exposed a Dagre CSP failure. The source now includes a fixed-command adapter and the development package has been rebuilt; the fix awaits manual in-app verification, and nothing is published. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Uses the WASM and official Go runtime from pinned `@terrastruct/d2@0.1.33`, compiling/rendering in a dedicated Worker. The adapter uses neither dynamic Function nor a weaker host CSP. Dagre is bundled statically at build time. A fixed-command adapter inside the dedicated Worker handles the WASM jsrunner calls: only the pinned upstream initialization, graph attributes, nodes, parents, edges, layout and result queries are accepted. Strings are never executed as JavaScript. The build checks embedded resource compatibility, and unknown commands fail explicitly. The compressed WASM is split into two declared assets, each under 5 MiB, read/decompressed/initialized on demand. First-load cost and runtime memory may be noticeably higher than lighter renderers.

Initially supports Dagre, a single static board and plain-text labels, with basic nodes, connections and containers. No ELK, external imports, images/icons, clickable links, Markdown/LaTeX labels, animation or multiple boards. Compilation receives only one in-memory file for the current block, with no note-directory or network access. Limits: 32 KiB / 1,000 lines input, 2 MiB output, plus host image dimension limits. Requires a modern desktop WebView supporting DecompressionStream.

Generated styles are flattened into SVG attributes in the isolated iframe before independent host filtering. Embedded font styles are omitted in favor of system fonts, so font shapes and layout can differ slightly from the official D2 editor.

[Usage](USAGE.md) · [中文](README.md)

## Development

After installing workspace dependencies and building the local SDK, run `pnpm --filter @notegen/plugin-d2 build`. The shared TypeScript entry bundles the adapter/Worker, copies compressed WASM and licenses, then invokes the CLI for the development directory. Upstream Go/WASM is unmodified.
