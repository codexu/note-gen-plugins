# Markmap Mind Maps

Preview Markdown outlines as static Markmap mind maps offline.

An approved build generates `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop host with the generic code-block renderer API and the modified local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching code blocks only, with no workspace-file or network access. The host provides preview by default, source switching, error feedback and renderer selection. Input is limited to 32 KiB and 1,000 lines; SVG output to 2 MiB plus host dimension limits. Engines load on demand and plugins have no runtime dependency on each other. Editor preview only; no export or mobile support.

Uses the Markmap transformer without extension plugins for Markdown headings/lists and d3-hierarchy for a static tree layout. Supports `markmap`. To work with the host static-SVG filter, labels contain text only and inline formatting is reduced to text. No folding, zoom controls, clickable links, images, formulas, external styles/scripts or frontmatter options. Limits: 400 nodes, 20 levels and 500 characters per label. Large outlines must be split if they exceed host image dimensions.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, run `pnpm --filter @notegen/plugin-markmap build` from the repository root. A TypeScript build entry is compiled into the ignored `.notegen` directory, bundles the adapter and separate engine, collects licenses for bundled dependencies, then generates `.notegen/package`. `plugin:pack` does not implicitly build. No JavaScript source or test files are added.
