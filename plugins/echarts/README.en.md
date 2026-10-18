# ECharts Preview

Preview ECharts JSON charts offline.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses ECharts 6 SVG SSR on a 720×420 canvas. Accepts JSON options only, with no JavaScript, formatter/renderItem callbacks or extension scripts. Supports common static charts; no maps, custom/lines/effectScatter series, external images, links, network data, animation or interaction. Explicit animation/universalTransition must be false. Arrays: 5,000 entries; nesting: 32 levels.

[Usage](USAGE.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-echarts build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
