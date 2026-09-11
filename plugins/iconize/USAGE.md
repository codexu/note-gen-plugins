# Using Iconize

Enable the plugin and open Settings → Extensions → Iconize, or choose “Iconize: Assign icon” from a file, folder or tab context menu. Context menus prefill the target. No rules are added on first activation.

1. Select Assignment and the file/folder kind. Enter a workspace-relative path such as `Notes/Example.md` or `Projects`.
2. Choose a built-in icon, or enter Emoji such as `📚`, `📝` or `🟦`. A nonempty Emoji field overrides the icon selector; clear it to use the built-in icon again.
3. Add the rule. The file tree and tabs use the same resolver.

Extension rules accept `md`, `pdf`, or `.MD` (normalized to `md`) and apply only to files. Defaults apply separately to files and folders with an empty target. Fixed paths match exactly. Folder icons do not propagate to descendants. Wildcards are unsupported.

Priority is assignment, fixed path, extension, then default. The first enabled match within a group wins. Drag to reorder within groups; cross-group drags are sorted back into priority order. Maximum 100 rules.

Each list menu offers edit, enable/disable and delete. Edit the target to rebind a rule after a move. New rule exits editing. Reload and apply restores the latest stored settings and discards the current unsaved form.

## Colors and moves

The current public API does not expose icon tint. Colored Emoji such as 🟥 🟧 🟨 🟩 🟦 🟪 can be used instead; their appearance depends on the operating system.

Following is off by default. Enable it for a file assignment and grant the optional note-list permission to receive observable note events. No note content is read. Observable moves update that assignment's path, while deletions remove it. If a destination already has an assignment, list order still decides precedence.

Folder, attachment, external-tool, offline and out-of-grant moves cannot reliably be followed. Folder following has no supporting event contract; edit its target manually. Fixed paths, extensions and defaults are never migrated automatically.

## Workspaces and recovery

Settings are isolated per workspace. Disabling restores the host or another provider's icons; enabling restores saved rules. No note files are modified. Other open windows require Reload and apply or a plugin restart; avoid concurrent editing across windows.

Providers resolve in plugin-ID order. If another provider matches first, disable the overlapping rule/provider. If application fails after saving, use Reload and apply: storage may already have succeeded.

Paths must pass SDK safety restrictions. Absolute paths, wildcards, reserved paths and certain file types cannot be assigned directly. Icons still work without optional permission, but automatic following does not.
