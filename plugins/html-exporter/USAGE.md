# Advanced HTML Export

Requires desktop NoteGen 0.39.1 or later with plugin protocol 0.1.12 and the `html-export` and `html-copy` capabilities.

## Choose a template and output

1. Enable the plugin and grant active-editor read and file-export access. To copy, also grant the optional clipboard write permission.
2. Open a Markdown note, click **HTML Export** in the status bar, and choose a template in the dialog.
3. Choose **Export HTML file**, **Copy HTML source**, or **Copy rich text**. File export opens the native save dialog; cancelling is not treated as failure.
4. Review any resource or content notices in the dialog. Paste source into a code editor or rich text into a compatible application.

If the status-bar entry is hidden, reveal it in NoteGen's plugin display settings or use the **Open advanced HTML export** command. Without an active note, templates can still be managed but output is disabled.

## Manage templates

Choose **Manage templates** in the dialog to create, edit, rename or delete custom templates. Deletion requires confirmation; deleting the selected template returns to the default style. The default style cannot be edited or deleted.

Each template has a name, CSS and JavaScript. Enter code without `<style>` or `<script>` tags. CSS and JavaScript are each limited to 10,000 characters, with up to 20 custom templates and 512 KiB total template data. Changes apply only on **Save**; Cancel, Escape and closing discard unsaved drafts.

Previously saved nonempty CSS or JavaScript becomes the selected **Previous configuration** template. The old storage key is retained; a read or save failure never overwrites the original data with an empty configuration.

```css
body.notegen-export { max-width: 960px; font-family: Georgia, serif; }
.notegen-export h2 { color: #245577; }
```

```javascript
document.querySelectorAll('h2').forEach(heading => {
  heading.title = heading.textContent || '';
});
```

## Files, source and rich text

File export and source copying both use complete HTML. CSS follows the defaults, and JavaScript only runs when a browser opens the file. Copying source writes complete HTML as clipboard text.

Rich-text copying writes an HTML fragment and readable plain-text fallback. The host inlines styles that can be converted safely; unsupported CSS, formulas or other content are downgraded with notices. Rich text never contains or runs JavaScript. A destination application may filter inline styles, data images or remote references, so results depend on that application.

The host captures the selected editor revision and template before output. If the note changes before capture, it asks you to retry; later edits do not alter that result. Workspace changes, plugin disablement and revoked permissions prevent a later write.

Local images in approved attachment folders can be embedded; unapproved or oversized resources produce notices. The plugin does not request remote images, fonts or CSS dependencies while producing output. Results can retain remote references that a destination application may load when opening the file or pasting rich text. HTML files embed CSS and JavaScript as data resources: use absolute or data URLs for dependencies. Relative CSS resource paths and relative script imports are unsupported.

This version has no preview, file imports or asset-folder packaging. The plugin has no general filesystem, clipboard-read or network access. No save path is returned to the plugin.
