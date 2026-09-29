# Using the Russian Language Pack

This plugin adds **Русский** to NoteGen on desktop and retains every built-in language. It requires NoteGen 0.37.1 or newer with language resource protocol 0.1.2.

## Switch to Russian

1. Install the pack and enable it in the current workspace.
2. Open Settings → General Settings → Interface Settings → Language.
3. Select **Русский**. The host refreshes interface messages.

Install from the plugin marketplace. For developer import, first build `.notegen/package` and enable Developer Mode in NoteGen.

## Restore another language

Choose a built-in language on the same page, or disable/uninstall the pack in plugin management. Without another Russian provider, the host restores its default, Simplified Chinese, while retaining the saved Russian preference for re-enablement. Note content is unaffected.

## Limitations

- No permissions are needed. The pack does not read notes, use the network, or translate note content or AI responses.
- New host fields may fall back to Chinese. Two Mermaid ER templates inherit the host examples; other code examples preserve English syntax. Other plugins own their Russian translations.
- If Русский is missing, check activation in the current workspace and host protocol support. With overlapping Russian providers, the lexically earlier plugin ID takes priority.
- Translations are a machine-assisted draft with revisions to common messages. Native Russian review and real desktop acceptance are pending. Mobile loading is not supported.
