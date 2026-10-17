# Graphviz Preview

Preview DOT and Graphviz code blocks offline.

An approved build generates `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop host with the generic code-block renderer API and the modified local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching code blocks only, with no workspace-file or network access. The host provides preview by default, source switching, error feedback and renderer selection. Input is limited to 32 KiB and 1,000 lines; SVG output to 2 MiB plus host dimension limits. Engines load on demand and plugins have no runtime dependency on each other. Editor preview only; no export or mobile support.

Uses the Graphviz WASM bundled by Viz.js with the dot layout in a dedicated Worker. Supports `dot` and `graphviz`. External images/files, interactive links and a layout-engine picker are unavailable. Generated SVG DTDs are removed and dimensions normalized before host filtering.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, run `pnpm --filter @notegen/plugin-graphviz build` from the repository root. A TypeScript build entry is compiled into the ignored `.notegen` directory, bundles the adapter and separate engine, collects licenses for bundled dependencies, then generates `.notegen/package`. `plugin:pack` does not implicitly build. No JavaScript source or test files are added.
