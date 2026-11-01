# Russian Language Pack

[简体中文](README.md) · [Usage](USAGE.md) · [中文使用说明](USAGE.zh-CN.md)

Adds **Русский** to NoteGen. Version `0.1.1` supplies declarative language resources without executable scripts, permissions, network requests or runtime dependencies.

## Install and switch

Install and enable the pack in the current workspace, then open Settings → General Settings → Interface Settings → Language and choose **Русский**. Hosts after the language migration build in only Simplified Chinese and English. NoteGen 0.39.1 retains its original built-in languages, which packs can supplement.

Supports released NoteGen `0.39.1` and later. Two Mermaid ER code templates inherit host values, so the unreleased unchanged-literal validation fix is not required. Language resource protocol `0.1.2` is unchanged. Desktop only: mobile message fields are retained but do not imply mobile installation support.

## Coverage and maintenance

`messages/ru.json` covers **5,168 fields: 5,166 supplied messages and two ER code templates inherited from the host** from the current host baseline, including `common`. It covers settings, records, tags, AI chat, the editor, files, sync, canvases, plugin management and windows. See [translation-baseline.json](translation-baseline.json) for the source commit, hashes and review status.

Existing translations retained; new plain messages drafted locally with Argos en-ru 1.9, with authored parameter messages and revisions to terminology and critical data-operation notices. Field coverage, ICU argument checks, host registration and fallback logic, plugin build/pack and the host production build passed on 2026-11-01. Desktop UI acceptance and native-language review remain pending.

- Preserve ICU argument names and compatible plural structures.
- Mermaid templates retain executable syntax. `settings.editor.mermaid.templates.er` and `editor.mermaid.templates.er` are omitted and inherited from the host so older ICU validators do not interpret literal `o{` as an argument. These two code examples are not untranslated UI messages.
- Keep the runtime `__PATH__` replacement marker in image-save messages.
- Missing fields follow host fallback rules; hosts after the migration prefer built-in English, then Simplified Chinese. Other plugins maintain their own translations.
- This pack does not read or translate notes or change AI response languages. Authoring tools and translation models are not shipped.

## Lifecycle

After disabling or uninstalling the pack, a built-in language or another provider remains usable. Otherwise its language option disappears and the interface temporarily uses the default Simplified Chinese while preserving the saved preference. Re-enabling restores it. Restarting and switching workspaces follow the current workspace’s enabled plugins. For overlapping translations, the lexically earlier plugin ID wins.

## Developer import

From the plugin repository (executed in this testing stage):

```bash
pnpm --filter @notegen/plugin-language-pack-ru build
pnpm --filter @notegen/plugin-language-pack-ru validate
pnpm --filter @notegen/plugin-language-pack-ru run plugin:pack
```

Enable Developer Mode in NoteGen and import the generated `.notegen/package`. The source directory is not a published installable package. Marketplace registration prepares metadata only; packaging, signing and publishing remain separate.

## Pending acceptance

Check installation, activation, selection, restart, workspace switching, disable and uninstall behavior; inspect long text, interpolation, counts, Mermaid samples, image paths and missing-field fallback. Review destructive-operation notices for accurate data effects. Complete native review and host compatibility confirmation before release.
