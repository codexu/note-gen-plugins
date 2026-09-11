# Using the Korean Language Pack

This independent plugin adds **한국어** to NoteGen. All built-in languages remain available.

## Switch to Korean

1. Install the pack and enable it in the current workspace.
2. Open Settings → General Settings → Interface Settings → Language.
3. Select **한국어**. The host refreshes the interface messages.

No permissions are required. The pack does not read notes, access the network, or translate note content or AI responses. A desktop host implementing language resource protocol `0.1.2` is required. This source folder is not itself a published release; developer import requires building `.notegen/package` and enabling Developer Mode.

## Restore another language

Select any built-in language in the same settings page, or disable/uninstall this pack in plugin management. If no other Korean provider remains, the host displays its built-in default (Simplified Chinese) and retains the saved Korean preference for re-enablement. Notes and other languages are unaffected.

## Some text is still Chinese

New host fields fall back to built-in Chinese. Two Mermaid ER code examples currently inherit the host templates. Code, product names, file paths, and commands intentionally remain literal. Other plugins manage their own interface translations and may not provide Korean.

If **한국어** is missing, check that this pack is enabled in the current workspace and that the host supports the language resource protocol. If multiple packs provide Korean, the lexically earlier plugin ID has priority for overlapping keys.
