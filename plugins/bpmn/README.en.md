# BPMN Preview

Preview BPMN 2.0 XML diagrams with embedded layout offline.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses bpmn-js Viewer for BPMN 2.0 XML containing BPMNDiagram/BPMNPlane, BPMNShape coordinates and BPMNEdge waypoints. XML with semantic definitions but no DI layout is not automatically laid out. Limits: 300 shapes and 600 connections. Does not execute processes, scripts or external calls, and does not edit models. XML DTDs/entities are rejected. The original bpmn.io watermark remains visible in the static-image footer. Styles are flattened into SVG attributes in isolation; light/dark defaults are provided.

[Usage](USAGE.en.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-bpmn build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
