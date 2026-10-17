# Nomnoml Preview

Preview Nomnoml text UML diagrams offline.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses Nomnoml in a dedicated Worker for UML SVG, supporting classifiers, relationships and common styling directives. Limited to 400 classifiers; no #import, external resources or interaction. Light/dark defaults can be overridden by explicit source directives.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-nomnoml build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
