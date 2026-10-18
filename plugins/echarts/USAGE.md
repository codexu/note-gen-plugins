# Using ECharts Preview

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the rendering disclosure.
2. Insert this fenced block into a note:

````markdown
```echarts
{
  "title": {"text": "Sales"},
  "xAxis": {"type": "category", "data": ["A", "B", "C"]},
  "yAxis": {"type": "value"},
  "series": [{"type": "bar", "data": [12, 24, 18]}]
}
```
````

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses ECharts 6 SVG SSR on a 720×420 canvas. Accepts JSON options only, with no JavaScript, formatter/renderItem callbacks or extension scripts. Supports common static charts; no maps, custom/lines/effectScatter series, external images, links, network data, animation or interaction. Explicit animation/universalTransition must be false. Arrays: 5,000 entries; nesting: 32 levels.

Use **Edit source** and **Preview** to switch. Errors preserve source for correction/retry. Disabling restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated previews, multiple diagrams and responsiveness.
- Edit, undo, save/reopen source preservation.
- Invalid syntax, oversized input, external resources and unsupported features.
- Disable/reload and workspace switches clear stale output; re-enabling restores previews.
- Verify the format-specific limitations above and absence of external resource requests.
