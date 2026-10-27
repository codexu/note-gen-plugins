# Advanced HTML Export

[中文](README.md)

An official NoteGen plugin that uses reusable CSS and JavaScript templates to export the active Markdown note as a standalone HTML file, or copy its HTML source or rich text. Output includes unsaved text and does not change the note.

Version **0.1.0** requires desktop **NoteGen 0.39.1** or later implementing plugin protocol **0.1.12** and the `html-export` and `html-copy` capabilities. Development uses **SDK 0.1.14**. Installing a newer SDK does not add these capabilities to an older host.

- Click **HTML Export** in the status bar to open a centered dialog. Choose a template, then export a file, copy HTML source, or copy rich text.
- Manage templates in the same dialog: create, edit, rename or delete custom templates. The default style cannot be modified or deleted. Templates are stored on this device: up to 20 custom templates, 10,000 characters each for CSS and JavaScript, and 512 KiB total template data.
- An existing nonempty configuration becomes the selected **Previous configuration** template. The original storage key is retained, and failed saves do not discard existing templates.
- HTML source includes the complete HTML and template CSS and JavaScript. Rich text includes safe rich text and portable inline styles, but does not contain or run JavaScript. Destination applications may filter styles, formulas or images.
- Active-editor read and file export are required; clipboard write and attachment read are optional. File export remains available without clipboard access; embedding images requires access to their folders.
- Output captures the note revision and template when invoked. Workspace changes, plugin disablement or revoked permissions prevent a later write. Resource and content degradation produce notices.
- English and Simplified Chinese interfaces follow the NoteGen language.

Template code uses ordinary multiline text fields. Syntax highlighting, previews, external file imports and dependency packaging are not included. The plugin does not execute custom scripts or fetch remote resources during configuration or output, and does not alter NoteGen, regular HTML export or PDF printing. Exported files and rich text may retain remote references that a destination application loads later.

See the [English usage guide](USAGE.md) for steps and examples.
