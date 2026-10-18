# DBML Database Diagrams

Preview DBML tables, fields and relationships offline.

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses official @dbml/parse on the current block, with Dagre layout in a dedicated Worker. Shows tables, field types, primary-key/not-null flags and relationship labels/cardinalities; supports Ref and inline ref. Limits: 50 tables, 500 fields, 200 relationships and 100 characters per label. No database connections, SQL execution or external DBML files. Notes, records, indexes and table groups are not rendered as separate visual objects. TablePartial expansion is unavailable; declare fields directly in each table.

[Usage](USAGE.md) · [中文](README.md)

## Development

After build approval, install workspace dependencies, build the local SDK and run `pnpm --filter @notegen/plugin-dbml build`. The shared TypeScript entry bundles the adapter and separate engine, collects licenses and generates `.notegen/package`. No JavaScript source or test files are added.
