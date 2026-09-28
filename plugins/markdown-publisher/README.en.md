# WeChat Article Formatter

An official NoteGen plugin for article typography, isolated previews, rich-text copying and HTML export. Includes Editorial, Technical Manual and Paper Reading templates. Built-in layouts require no CSS. Named custom CSS templates are saved on this device.

Requires desktop **NoteGen 0.38.0** or later with plugin API protocol **0.1.7**. Development uses SDK **0.1.9**. `pnpm dev` builds and reloads the local development package automatically.

- Reads the active note, including unsaved edits; never modifies the Markdown.
- Each built-in template has editable accent, text color, background, font, size and line height, with a restore-default action. New templates can be saved from a base style using these controls alone; `.article` CSS is an optional advanced override.
- Shares one rendered document between preview, rich clipboard and HTML export.
- Marks changed snapshots stale and requires refresh before output.
- Optional attachment permission embeds small local PNG/JPEG/GIF/WebP images from approved folders.
- Create and edit templates in plugin settings; each template keeps its own parameters. The bottom status bar shows both icon and name; selecting a template in its right-side drawer immediately refreshes the layout. Switch between phone and desktop frames, then copy or export. The Markdown editor remains unchanged.

English and Simplified Chinese UI follow NoteGen's language. Configuration is stored on this device. See [usage](USAGE.md), [Chinese README](README.md) and [SDK integration](https://github.com/codexu/note-gen-plugin-sdk/blob/main/HOST-DOCUMENT-INTEGRATION.md).

After importing the local development plugin once, run `pnpm dev` in this plugin directory. Saving source, manifest or locale files automatically builds a new snapshot; NoteGen reloads the enabled development plugin without another import. Failed builds keep the last working version and report errors in the terminal. Stop the watcher with Ctrl+C.

Remote images are not fetched in previews. Formula/Mermaid conversion, image uploading and direct platform publishing are outside this version; validate actual WeChat paste results before publishing.
