# Using WaveDrom Preview

An approved build generates `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop host with the generic code-block renderer API and the modified local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import the development package, enable the plugin and review the code-block rendering disclosure.
2. Insert this fenced code block into a note:

````markdown
```wavedrom
{
  signal: [
    {name: 'clk', wave: 'p.......'},
    {name: 'data', wave: 'x.345x..', data: ['A', 'B', 'C']}
  ]
}
```
````

Reads matching code blocks only, with no workspace-file or network access. The host provides preview by default, source switching, error feedback and renderer selection. Input is limited to 32 KiB and 1,000 lines; SVG output to 2 MiB plus host dimension limits. Engines load on demand and plugins have no runtime dependency on each other. Editor preview only; no export or mobile support.

Uses WaveDrom and JSON5. Supports `signal` waveforms, groups, plain-text titles and edges. Does not use upstream eval-based entry points. Register/assignment diagrams (`reg`/`assign`), custom skins and rich JsonML labels are unsupported. Limits: 64 lanes, 256 wave characters per lane, 12 grouping levels and hscale 1–4. The default skin retains a white canvas in dark editors for readability. The skin is cloned per render and styles are flattened into SVG attributes.

Use **Edit source** and **Preview** to switch. Failures preserve source for correction and retry. Choose a default renderer when multiple plugins support the same type. Disabling a plugin restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Render the example, different diagrams and duplicate diagrams without cross-contamination.
- Edit source, switch back to preview, undo, save and reopen without changing Markdown source.
- English/Chinese, light/dark, narrow windows and sectioned long documents.
- Invalid syntax, oversized input and external resources show errors while preserving source.
- Disable or switch workspace during rendering; stale results disappear and enabling restores previews.
- First load, cached previews, complex-diagram responsiveness and no remote requests.
