# Using Nomnoml Preview

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the rendering disclosure.
2. Insert this fenced block into a note:

````markdown
```nomnoml
[User] -> [Service]
[Service] -> [<database>Database]
```
````

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses Nomnoml in a dedicated Worker for UML SVG, supporting classifiers, relationships and common styling directives. Limited to 400 classifiers; no #import, external resources or interaction. Light/dark defaults can be overridden by explicit source directives.

Use **Edit source** and **Preview** to switch. Errors preserve source for correction/retry. Disabling restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated previews, multiple diagrams and responsiveness.
- Edit, undo, save/reopen source preservation.
- Invalid syntax, oversized input, external resources and unsupported features.
- Disable/reload and workspace switches clear stale output; re-enabling restores previews.
- Verify the format-specific limitations above and absence of external resource requests.
