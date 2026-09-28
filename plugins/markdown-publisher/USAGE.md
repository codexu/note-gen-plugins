# Use WeChat Article Formatter

1. Install and enable the plugin on a protocol 0.1.7 desktop host. Grant active-editor read, clipboard write and file-export permissions. Attachment read is optional.
2. In **Settings → Extensions → WeChat Article Formatter**, select a template and adjust its accent, body color, background, font, size and line height. Built-in templates can be edited and restored to their defaults.
3. Choose **Create template**, enter a name, pick a base style and adjust the controls to save a new template. Custom CSS is optional; add a rule such as `.article h2 { color: #2563eb; }` only for finer control. Select a saved template to edit or delete it. Each template is stored separately on this device.
4. Open a Markdown note and click **WeChat Formatting** in the bottom status bar. The right-side drawer immediately renders with your last selected template. Switch between phone and desktop frames, then use the refresh, copy and export buttons. The preview does not change the Markdown editor or the note.
5. Check images and article content in the preview. With attachment permission, small local images can be embedded. Remote images are not loaded in the preview. Math and Mermaid remain text.
6. Click **Copy for WeChat** and verify the pasted article in the WeChat editor, or choose **Export HTML** to open a native save dialog. Refresh after the note changes or the active note switches before copying or exporting.

CSS supports descendant selectors rooted at `.article` and portable typography properties. Imports, URL assets, variables, pseudo selectors and app UI selectors are rejected. The plugin never sends content to a publishing service.

For local development, import once and run `pnpm dev` in the plugin directory. Saving source, manifest or locale files rebuilds and reloads the enabled plugin automatically; a failed build leaves the previous working version in place.
