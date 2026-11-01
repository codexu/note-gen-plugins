# Japanese Language Pack

[简体中文](README.md) · [Usage](USAGE.md) · [中文使用说明](USAGE.zh-CN.md)

Adds **日本語** to NoteGen. Version `0.1.0` supplies declarative language resources without executable scripts, permissions, network requests or runtime dependencies.

## Install and switch

Install and enable the pack in the current workspace, then open Settings → General Settings → Interface Settings → Language and choose **日本語**. Only Simplified Chinese and English are built in; other interface languages are independent plugins.

Requires a NoteGen host containing this language migration and the unchanged-literal template validation fix. The manifest minimum is `0.39.1`; an older build bearing that version may lack the fix. Confirm the actual minimum host version before release. Language resource protocol `0.1.2` is unchanged. Desktop only: mobile message fields are retained but do not imply mobile installation support.

## Coverage and maintenance

`messages/ja.json` provides all **5,168 string fields** from the current host baseline, including `common`. It covers settings, records, tags, AI chat, the editor, files, sync, canvases, plugin management and windows. See [translation-baseline.json](translation-baseline.json) for the source commit, hashes and review status.

Existing built-in translations migrated and missing host messages translated. Field coverage, ICU argument checks, host registration and fallback logic, plugin build/pack and the host production build passed on 2026-11-01. Desktop UI acceptance and native-language review remain pending.

- Preserve ICU argument names and compatible plural structures.
- Mermaid templates use unchanged host code, including literal braces in ER examples. Code samples are not natural-language translations. The host must support registration of unchanged literal templates.
- Keep the runtime `__PATH__` replacement marker in image-save messages.
- Future untranslated fields fall back to built-in English, then Simplified Chinese. Other plugins maintain their own translations.
- This pack does not read or translate notes or change AI response languages. Authoring tools and translation models are not shipped.

## Lifecycle

Disabling or uninstalling the pack removes its language option. Without another provider for the same language, the interface temporarily uses the default Simplified Chinese while preserving the saved language preference. Re-enabling restores it. Restarting and switching workspaces follow the current workspace’s enabled plugins. For overlapping translations, the lexically earlier plugin ID wins.

## Developer import

From the plugin repository (executed in this testing stage):

```bash
pnpm --filter @notegen/plugin-language-pack-ja build
pnpm --filter @notegen/plugin-language-pack-ja validate
pnpm --filter @notegen/plugin-language-pack-ja run plugin:pack
```

Enable Developer Mode in NoteGen and import the generated `.notegen/package`. The source directory is not a published installable package. Marketplace registration prepares metadata only; packaging, signing and publishing remain separate.

## Pending acceptance

Check installation, activation, selection, restart, workspace switching, disable and uninstall behavior; inspect long text, interpolation, counts, Mermaid samples, image paths and missing-field fallback. Review destructive-operation notices for accurate data effects. Complete native review and host compatibility confirmation before release.
