# Using D2 Preview

Requires the desktop host with the generic code-block renderer API and the local SDK/CLI. An approved build generates `.notegen/package`; manual in-app validation exposed a Dagre CSP failure. The source now includes a fixed-command adapter and the development package has been rebuilt; the fix awaits manual in-app verification, and nothing is published. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the code-block disclosure.
2. Paste this fenced block into a note:

````markdown
```d2
user: 用户
gateway: 网关
service: 服务

user -> gateway -> service
```
````

Preview appears by default. Use **Edit source** and **Preview** to switch; errors preserve source for correction/retry. Disabling restores ordinary code blocks.

Uses the WASM and official Go runtime from pinned `@terrastruct/d2@0.1.33`, compiling/rendering in a dedicated Worker. The adapter uses neither dynamic Function nor a weaker host CSP. Dagre is bundled statically at build time. A fixed-command adapter inside the dedicated Worker handles the WASM jsrunner calls: only the pinned upstream initialization, graph attributes, nodes, parents, edges, layout and result queries are accepted. Strings are never executed as JavaScript. The build checks embedded resource compatibility, and unknown commands fail explicitly. The compressed WASM is split into two declared assets, each under 5 MiB, read/decompressed/initialized on demand. First-load cost and runtime memory may be noticeably higher than lighter renderers.

Initially supports Dagre, a single static board and plain-text labels, with basic nodes, connections and containers. No ELK, external imports, images/icons, clickable links, Markdown/LaTeX labels, animation or multiple boards. Compilation receives only one in-memory file for the current block, with no note-directory or network access. Limits: 32 KiB / 1,000 lines input, 2 MiB output, plus host image dimension limits. Requires a modern desktop WebView supporting DecompressionStream.

Generated styles are flattened into SVG attributes in the isolated iframe before independent host filtering. Embedded font styles are omitted in favor of system fonts, so font shapes and layout can differ slightly from the official D2 editor.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated rendering and retry after Worker timeout.
- Invalid syntax, external imports, icons/images, rich labels and oversized diagrams.
- Edit, undo, save/reopen source preservation; workspace switches and disablement clear stale results.

CSP regression checks after rebuilding: the three-node example, repeated renders, all four directions, nested containers, self-loops, parallel edges and escaped edge names. Unknown layout commands must fail without executing source text as JavaScript.
