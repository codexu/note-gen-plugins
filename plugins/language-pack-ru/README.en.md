# Russian Language Pack

[简体中文](README.md) · [Русский: инструкция](USAGE.ru.md)

An independent NoteGen interface language pack. After installation and activation, open Settings → General Settings → Interface Settings → Language and select **Русский**. The host refreshes interface messages while retaining all built-in language options.

This is the **0.1.0 initial release**. Translations began as a local machine-assisted draft, with revisions to common UI terminology, parameterized messages and technical terms. Native Russian review and desktop acceptance remain pending.

| Item | Value |
| --- | --- |
| Plugin ID | `top.notegen.language-pack-ru` |
| Workspace package | `@notegen/plugin-language-pack-ru` |
| Locale / language label | `ru` / Русский |
| Minimum host | NoteGen 0.37.1 with language resource protocol 0.1.2 |
| Platform | Desktop |
| Permissions / runtime script | None / none |

## Coverage and maintenance

`messages/ru.json` follows the host's nested message structure, including `common`. It covers common actions, settings, plugin management, the editor, records, AI chat, files, sync, retrieval, canvas and windows. Mobile messages are included as data, but language resources currently register only on desktop. The pack's own name and description are available in English, Simplified Chinese and Russian.

The baseline is committed host revision `3284534d3e5ea12abf0c7de5981d4cca2c26f62c`, excluding uncommitted host changes. The pack provides 4,388 of 4,390 string fields. [translation-baseline.json](translation-baseline.json) records source hashes, the commit, exceptions and review status. Coverage is not evidence of runtime acceptance or a full native-language review.

- Count messages use Russian ICU `one`, `few`, `many` and `other` forms, or wording such as “Количество: {count}” that avoids inflection. Parameter names and code identifiers are preserved.
- `editor.slashCommand.imageUpload.savePath` retains the host's literal `__PATH__` replacement marker.
- `settings.editor.mermaid.templates.er` and `editor.mermaid.templates.er` inherit the host examples. Their Chinese baseline contains literal `o{`, which the host ICU validator interprets as an invalid argument. Other Mermaid templates retain the executable English examples.
- New or missing host fields fall back to Simplified Chinese. Other plugins own their translations; this pack does not translate their messages.
- The authoring model, cache and scripts are not shipped. Using the pack needs no translation model, network connection or additional runtime dependencies.

For updates, use the Chinese host tree and parameter names as the authority and the English messages from the same revision as the translation source. Update the baseline metadata and document unreviewed or fallback areas instead of counting untranslated English copies as Russian coverage.

## Building and developer import

This package uses the workspace's `@notegen/plugin-cli` and `.sdk` configuration. The existing `plugins/*` workspace glob includes it. Run these from the plugin repository:

```bash
pnpm --filter @notegen/plugin-language-pack-ru build
pnpm --filter @notegen/plugin-language-pack-ru validate
pnpm --filter @notegen/plugin-language-pack-ru run plugin:pack
```

Developer import uses the generated `.notegen/package` and requires Developer Mode in NoteGen. The source directory itself is not an installable package. The minimum version alone does not guarantee that an older host implements the required resource protocol.

## Lifecycle and acceptance

Resources register while the plugin is enabled in the current workspace. Disabling or uninstalling the last Russian provider restores the built-in default, Simplified Chinese, while retaining the saved `ru` choice for re-enablement. If several packs provide Russian, the lexically earlier plugin ID wins on overlapping keys. This pack does not read, modify or translate note content, or change the output language of AI models.

Pending manual acceptance:

1. Build, import and enable the pack; choose Русский and inspect navigation, Save/Cancel, the editor and plugin settings.
2. Inspect long Russian text in narrow windows, sidebars and dialogs.
3. Check counts 1, 2, 5, 11, 21, 22 and 25, plus dynamic paths, names and error messages.
4. Switch to a built-in language and back; inspect restart, workspace switching, disable/uninstall and re-enable behavior.
5. Inspect missing-field fallback, Mermaid examples, image save paths and overlapping language providers.
6. Obtain native Russian review, particularly for permissions, destructive/sync actions and AI instructions, and revise the translations accordingly.

These manual acceptance steps remain pending. Mobile execution is not supported.
