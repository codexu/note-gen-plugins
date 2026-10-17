# Using Excalidraw Preview

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the rendering disclosure.
2. Insert this fenced block into a note:

````markdown
```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "id": "box-a",
      "type": "rectangle",
      "x": 0,
      "y": 0,
      "width": 180,
      "height": 100,
      "angle": 0,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#a5d8ff",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "groupIds": [],
      "frameId": null,
      "roundness": {
        "type": 3
      },
      "seed": 12345,
      "version": 1,
      "versionNonce": 12345,
      "isDeleted": false,
      "boundElements": [],
      "updated": 1,
      "link": null,
      "locked": false
    }
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
```
````

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses official @excalidraw/utils to export complete Excalidraw JSON scenes, previewing rectangles, ellipses, diamonds, lines, arrows, freehand strokes and text. No canvas editing, images/attachments, embeddables, links, frames or scene migration. Limits: 400 elements and 5,000 points per array; input remains limited to 32 KiB. Provide full exported element properties and seeds. Text uses a system sans-serif font, so handwritten fonts and line wrapping may differ from the official editor. The large upstream export module is compressed into four asset chunks at build time and decompressed on first use, requiring a modern desktop WebView with DecompressionStream. The development package is about 13.3 MiB and the decompressed engine script about 19 MiB. In-app cold-start cost and runtime memory remain unmeasured.

Use **Edit source** and **Preview** to switch. Errors preserve source for correction/retry. Disabling restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated previews, multiple diagrams and responsiveness.
- Edit, undo, save/reopen source preservation.
- Invalid syntax, oversized input, external resources and unsupported features.
- Disable/reload and workspace switches clear stale output; re-enabling restores previews.
- Verify the format-specific limitations above and absence of external resource requests.
