# Vega Charts

Preview Vega and Vega-Lite charts offline using inline data.

An approved build generates `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop host with the generic code-block renderer API and the modified local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching code blocks only, with no workspace-file or network access. The host provides preview by default, source switching, error feedback and renderer selection. Input is limited to 32 KiB and 1,000 lines; SVG output to 2 MiB plus host dimension limits. Engines load on demand and plugins have no runtime dependency on each other. Editor preview only; no export or mobile support.

One plugin supports `vega`, `vega-lite` and `vegalite`. Uses Vega 5 / Vega-Lite 5 compatible with the Node 20 toolchain, with an expression interpreter for the host CSP and no eval. Inline data only; URL fields, links and image marks are rejected. No hover tooltips, interactive filtering or note attachments. Arrays are limited to 5,000 entries and JSON nesting to 32 levels. Light/dark defaults can be overridden by explicit chart configuration.

[Usage](USAGE.md) · [中文](README.md)

## Development

After build approval, run `pnpm --filter @notegen/plugin-vega build` from the repository root. A TypeScript build entry is compiled into the ignored `.notegen` directory, bundles the adapter and separate engine, collects licenses for bundled dependencies, then generates `.notegen/package`. `plugin:pack` does not implicitly build. No JavaScript source or test files are added.
