# ABC Sheet Music

Preview ABC music notation as static sheet music offline.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses the visual-only abcjs entry for SVG sheet music, without MIDI, soundfonts, playback or score-editor modules. One tune with X:/K: headers and one SVG page per block; split longer scores. Parser warnings are surfaced as preview errors, preserving source for correction. Dark mode adjusts the foreground; score text uses system fonts. External includes and embedded markup are rejected.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-abc build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
