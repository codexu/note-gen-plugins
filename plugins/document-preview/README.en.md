# Document Preview

Requires NoteGen **0.37.1 or later** and the plugin API declared in `plugin.json`.

Official, offline, read-only previews for NoteGen desktop using plugin API 0.1.2's format resources, isolated iframe, chunked document reads and declared package assets. No host private modules, document uploads or LibreOffice installation.

[中文](README.md) · [Usage](USAGE.md)

## Implemented formats

| Format | Features | Boundaries |
| --- | --- | --- |
| PDF | PDF.js page canvas, previous/next/jump, 25–300% zoom, fit width, selectable text, document search with match navigation, local password input | No OCR, PDF JavaScript, XFA or editable forms/annotations. Very large images are limited. |
| DOCX | docx-preview HTML layout: body, images, tables, headers/footers and footnotes/endnotes; zoom | Font substitution, floating objects and pagination can differ. No tracked changes, comments or embedded HTML. Not Word-identical layout. |
| XLSX | SheetJS Worker, sheet selector including labelled hidden sheets, 100-row windows, row jump, horizontally scrollable columns, selectable cell text and formula tooltips | **Data browser, not print-layout preview.** Cached formula results only; no recalculation, charts, merged-cell layout, conditional formatting, images, macros or external connections. |
| PPTX | Static HTML/SVG slides, page navigation, keyboard controls, 10–300% zoom, fit window and NoteGen status bar page counts | No animation, transitions or media playback. Complex SmartArt, vector art and fonts may differ. Legacy PPT is unsupported. |

Legacy `.doc`, `.xls`, `.ppt`, `.xlsm` and `.docm` are not registered. Text extraction or Markdown conversion is never presented as original document rendering.

## Bundling and installation

Dependencies are pinned to `pdfjs-dist@4.10.38`, `docx-preview@0.3.7`, `jszip@3.10.1`, SheetJS CE `0.20.3` from the official CDN tarball, and `@aiden0z/pptx-renderer@1.2.4`. The maintainer build uses esbuild and the workspace NoteGen CLI.

`scripts/build.mjs` creates separate classic IIFE renderers, bundles the matching PDF Worker, and packs CMaps/standard fonts into one base64 JSON resource to remain below the 100-assets-per-preview limit. XLSX has a separate parsing Worker. All resources, English/Chinese usage guides, dependency licenses and font/CMap notices are included in the plugin archive. A resource larger than 5 MiB fails the build. **End users do not run npm install.**

The development package has been built and validated by the SDK; release acceptance is still pending. The PDF worker is now bundled as a classic worker for compatibility with Chromium opaque origins. Its resource path remains `dist/pdf.worker.mjs`, but it is no longer loaded in module mode. Maintainers can run from the repository root:

```sh
pnpm install
pnpm --filter @notegen/plugin-document-preview build
pnpm --filter @notegen/plugin-document-preview plugin:pack
```

Generate `dist` before SDK validation/packaging. Development import targets this plugin's `.notegen/package` and requires Developer Mode. Production packaging/signing follows the repository release process; nothing has been published.

## Limits and lifecycle

The bridge serializes reads of at most 1 MiB, with a 30-second read timeout. PDF input is limited to 128 MiB; DOCX/XLSX/PPTX to 32 MiB. Chunks are assembled before parsing: this is not streaming or random-access parsing, and peak memory exceeds file size. The host supplies a maximum size, not the actual document length; an empty chunk marks EOF.

Office ZIP admission rejects encryption, ZIP64, split archives, duplicate/unsafe paths and malformed metadata. Limits: 4096 entries, 32 MiB per expanded entry, 16 MiB per XML entry, 96 MiB total expansion, 200:1 compression ratio and 128 XLSX sheets. Metadata checks are not process memory quotas. XLSX Worker requests terminate after 30 seconds. DOCX layout runs on the iframe thread and cannot be reliably interrupted; closing the preview releases its container.

XLSX browsing covers the first 100000 rows and 256 columns, with explicit truncation notices; displayed cells are capped at 32768 characters and formula tooltips at 8192. PDF uses only the current page canvas, capped near 16 million pixels. Search stops at 2000 pages, 5000 matches or 16 million extracted characters and labels partial results. English case is ignored; no OCR, fuzzy matching, dehyphenation or cross-page matching. Ligatures/columns depend on PDF text extraction order.

On close, the host disposes the iframe/port and the plugin cancels rendering, terminates Workers, rejects pending operations and revokes object URLs. Nothing is cached persistently. Rendering libraries are loaded only for the opened extension; PDF font/CMap data is loaded when requested.

## PPTX implementation

Uses [`@aiden0z/pptx-renderer@1.2.4`](https://github.com/aiden0z/pptx-renderer), whose published package includes its Apache-2.0 LICENSE. JSZip, ECharts and their notices ship inside the plugin. `dist/pptx.js` is loaded only for PPTX files; these dependencies do not ship in the NoteGen application installer.

Only the current slide is mounted; slides and media are parsed on demand. Limits: 32 MiB input, 300 slides, 64 MiB expanded media, two concurrent ZIP reads, plus the common Office ZIP limits. Slide dimensions must be finite positive values at most 20000 CSS px. Closing disposes the viewer, charts, blob URLs and resize observer. Parsing/layout remains on the iframe thread and cannot be reliably preempted.

`pdfjs: false` disables the EMF embedded-PDF fallback. Its optional PDF.js 5/6 peer is unused, so the existing PDF renderer stays on 4.10.38; installation may report that optional peer mismatch. Document links, shape actions and media playback are disabled. Network CSP remains restricted.

This change adds source integration and installed dependencies only. No build, tests, lint or type checks were run for PPTX; the development import package has not been refreshed. Earlier PDF checks do not establish PPTX acceptance.

## Contract and verification

Source review covered the current SDK resource contract/types/packager and the host preview iframe implementation. Required format registration, isolated rendering, large-file reading and resource loading already exist. The manifest uses `workspace-folder`; the default `.` grant covers the whole workspace, while the preview protocol still binds reads to the currently opened file and does not let a renderer choose arbitrary paths. This update adds locale to the host initialization message; no SDK change is required.

The init message carries the NoteGen interface `locale`; changing it reloads the preview. Unsupported languages and older hosts that omit it fall back to English. Host theme and exact file size are still unavailable. UI colors follow the system preference; document pages retain their own colors.

Local verification on 2026-09-11: dependency installation, plugin build and SDK validation passed. An isolated harness using the host's actual nested iframe HTML and plugin scripts passed two-page PDF canvas, text-layer, page-navigation and document-search checks in WebKit and Chromium. Document reads came from the test bridge; this does not establish real NoteGen import or user-file acceptance. Host fixes cover desktop command registration, blob creation inside the outer iframe, inherited CSP and initialization timing.

Pending desktop acceptance includes permissions/revocation, CJK and encrypted/scanned/damaged PDFs, search during navigation/close, complex DOCX layouts, XLSX cached formulas/hidden and empty sheets/large ranges, offline use, workspace changes and disable/update/uninstall. No lint or type checks were run, and nothing has been published.

Shared integration still needs the root lockfile, README list and marketplace registry entry. The existing `plugins/*` workspace already discovers this directory, so no root package.json change is needed. Only publish real, built and verified artifact URLs/hashes.
