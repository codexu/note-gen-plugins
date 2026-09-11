# Dynamic Templates

Create meeting minutes, daily reports and reading notes from Markdown templates, including your own saved files.

## Getting started

1. Configure **Template folder** (default `Templates`) and **New note folder** (default `Notes`). Use workspace-relative directories without `.`, `..`, hidden directories, absolute paths or template variables.
2. Grant `notes.read` and `notes.list` access to the template folder. The destination setting binds `notes.create` and `notes.open`. When changing the template folder, update its read/list grants too. The host currently allows only one automatic folder-permission binding.
3. Run **Create note from template**, or place the cursor in Markdown **source mode** and run **Insert dynamic template**. File and editor context menus also provide entry points.
4. Choose a built-in template or saved `.md` file, fill in the fields, inspect the preview and confirm. Enter a new note title without `.md`; the file is created in the configured destination.

Templates are listed recursively, 50 files per page. Built-ins remain available on each page. Files are read from saved content, not unsaved editor changes. Built-ins follow the plugin UI language (English or Chinese) and are bundled into the plugin; they are never automatically written into your workspace. Copy examples from the repository's `templates/en` or `templates/zh-CN` directory to customize them.

## Two ways to customize

The plugin's dedicated settings page explains both options and includes **Create template**. The template chooser has the same button.

- **Hand-written files**: save Markdown in the configured folder and write variables and field metadata using the syntax below.
- **Creation wizard**: enter a filename and Markdown body. Include custom variables such as `{{field.topic}}`; the next step lets you configure each field's display label, text/textarea/date type, required flag and default, without writing JSON. Review the generated source and save, or return to editing.

Both methods produce ordinary editable `.md` files. The wizard allows 16,000 body characters and 20 custom fields, configured six per page. Hand-written files retain their 64 KiB limit. Without custom fields, the wizard saves plain Markdown.

The wizard requires the optional `notes.write` grant scoped only to your template folder. Although this API permission permits writing files, the plugin sends only create requests and never supplies the revision needed to overwrite an existing file; same-name files are rejected by the host. It does not automatically open saved templates or widen note-opening grants. Reopen the template chooser to select the new file. Cancellation and workspace changes invalidate unsubmitted drafts; dispatched writes cannot be undone.

## Syntax v1

| Variable | Value |
| --- | --- |
| `{{date}}` | Local date at preview time, `YYYY-MM-DD` |
| `{{time}}` | Local time portion returned by the host |
| `{{datetime}}` | Full local date and time returned by the host |
| `{{title}}` | Active filename without `.md`, or the entered new note title |
| `{{selection}}` | Selection captured when the command opens; empty if none |
| `{{field.topic}}` | User-entered value of the custom `topic` field |

Whitespace inside braces is allowed. Dates come from public `calendar.resolveDay` with the system time zone and midnight boundary, and are frozen at preview time. The active title is empty if the host does not supply a file path.

Declare custom fields in a JSON comment at the **start of the file**:

```markdown
<!-- notegen-template
{
  "fields": [
    { "id": "topic", "label": "Topic", "type": "text", "required": true },
    { "id": "summary", "label": "Summary", "type": "textarea", "default": "" },
    { "id": "due", "label": "Due date", "type": "date" }
  ]
}
-->
# {{title}}

Date: {{date}}
Topic: {{field.topic}}
Summary: {{field.summary}}
Due: {{field.due}}

{{selection}}
```

Supported field types: `text`, `textarea`, `date`. Defaults must be strings. Up to 20 fields, each limited to 4,000 characters. IDs start with an ASCII letter, followed by letters, digits or underscores, up to 40 characters. IDs must be unique and cannot use built-in variable names, `constructor`, `prototype` or `__proto__`. Unknown field properties, unknown variables and malformed braces produce errors. Both source and rendered output are limited to 64 KiB UTF-8.

The metadata comment is removed. Substitution happens once; braces in entered values or selected text are not evaluated again. Values are inserted as literal Markdown without Markdown escaping. Markdown, code fences and YAML front matter remain unchanged except for listed variable substitutions. v1 has no escape syntax for literal double braces; avoid `{{` and `}}` in fixed template text.

## Content protection and cancellation

- Insertions use the original cursor position, or the end of the original selection. **Selected text is never deleted.** Including `{{selection}}` will repeat that text in the inserted content.
- The host currently supports fixed Markdown range edits only in source mode. Switch from visual or sectioned mode before inserting.
- Workspace, editor, document and revision are checked before applying. Changed content, another active editor or composition input blocks the old edit. Moving the cursor does not change the captured insertion position. There is no automatic relocation or retry.
- Atomic `openOrCreate` opens existing same-name notes without changing their contents. A notice distinguishes creation from an existing destination. If opening fails after creation, inspect the reported file before retrying.
- Closing the dialog before applying cancels the operation. Workspace changes and plugin shutdown invalidate old forms. A write already dispatched to the host cannot be cancelled or rolled back by closing the dialog. After a timeout or submission error, inspect the destination before starting again.
- Preview shows Markdown source and explicitly truncates beyond 12,000 characters; applying uses the full content. Close and restart to revise fields.

This is an independent syntax, not an Obsidian Templater API implementation. It runs no JavaScript, shell commands, arbitrary system commands or network requests. Permissions cover editor read/write, template listing/reading, and note creation/opening; optional notes.write supports create-only template requests; delete, move and network permissions are not requested.
