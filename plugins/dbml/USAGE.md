# Using DBML Database Diagrams

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the rendering disclosure.
2. Insert this fenced block into a note:

````markdown
```dbml
Table users {
  id integer [pk]
  name varchar
}

Table posts {
  id integer [pk]
  user_id integer [ref: > users.id]
  title varchar
}
```
````

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses official @dbml/parse on the current block, with Dagre layout in a dedicated Worker. Shows tables, field types, primary-key/not-null flags and relationship labels/cardinalities; supports Ref and inline ref. Limits: 50 tables, 500 fields, 200 relationships and 100 characters per label. No database connections, SQL execution or external DBML files. Notes, records, indexes and table groups are not rendered as separate visual objects. TablePartial expansion is unavailable; declare fields directly in each table.

Use **Edit source** and **Preview** to switch. Errors preserve source for correction/retry. Disabling restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated previews, multiple diagrams and responsiveness.
- Edit, undo, save/reopen source preservation.
- Invalid syntax, oversized input, external resources and unsupported features.
- Disable/reload and workspace switches clear stale output; re-enabling restores previews.
- Verify the format-specific limitations above and absence of external resource requests.
