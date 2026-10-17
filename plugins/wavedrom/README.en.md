# WaveDrom Preview

Preview WaveDrom digital timing diagrams offline.

An approved build generates `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop host with the generic code-block renderer API and the modified local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching code blocks only, with no workspace-file or network access. The host provides preview by default, source switching, error feedback and renderer selection. Input is limited to 32 KiB and 1,000 lines; SVG output to 2 MiB plus host dimension limits. Engines load on demand and plugins have no runtime dependency on each other. Editor preview only; no export or mobile support.

Uses WaveDrom and JSON5. Supports `signal` waveforms, groups, plain-text titles and edges. Does not use upstream eval-based entry points. Register/assignment diagrams (`reg`/`assign`), custom skins and rich JsonML labels are unsupported. Limits: 64 lanes, 256 wave characters per lane, 12 grouping levels and hscale 1–4. The default skin retains a white canvas in dark editors for readability. The skin is cloned per render and styles are flattened into SVG attributes.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, run `pnpm --filter @notegen/plugin-wavedrom build` from the repository root. A TypeScript build entry is compiled into the ignored `.notegen` directory, bundles the adapter and separate engine, collects licenses for bundled dependencies, then generates `.notegen/package`. `plugin:pack` does not implicitly build. No JavaScript source or test files are added.
