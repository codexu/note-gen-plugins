# Using NoteGen Themes

Choose from three paired light/dark themes: Paper & Ink (warm paper and brown ink), Pine (gray-green surfaces and pine accents), and Sea Mist (cool gray surfaces and blue accents). Each mode defines all 16 public color tokens for backgrounds, text, cards, primary actions, secondary surfaces, hover surfaces, borders, and shadows.

1. Install and enable the resource pack in NoteGen's plugin manager. Installing alone does not select a theme.
2. Open Settings → General → Interface and select 纸墨 · Paper & Ink, 松林 · Pine, or 海岚 · Sea Mist in the theme package selector.
3. Use the host's Light, Dark, or System appearance option. Each theme includes both modes; no separate dark pack is needed.

The pack requests no permissions, reads no notes, accesses no network, and executes no plugin JavaScript. Fonts, layout, icons, and styles outside the public color tokens remain managed by NoteGen.

## Custom color precedence

Colors are layered in this order: host defaults → selected theme package → user custom colors. User overrides apply per token and per mode; a null override reveals the theme's color. Selecting, switching, or disabling a theme never clears your custom colors.

If only some colors change, an earlier built-in preset, imported palette, or manual customization may still override the pack. To see the complete theme, first export any custom scheme you want to preserve, then reset individual colors or reset all custom colors on the presets page. With a theme package selected, resetting custom colors reveals that package's palette.

Built-in presets write to the user override layer, so applying one also overrides this pack. Do not import this pack's plugin.json into the custom palette editor: those formats differ.

## Disable and restore

Select Default in the theme package selector to remove the package palette while keeping custom colors. Disabling or uninstalling this plugin removes its three choices. If the selected theme becomes unavailable, the host falls back to its default colors plus user overrides.

The host remembers the previously selected theme ID. Re-enabling or reinstalling the same plugin may restore that selection if you have not chosen another theme. Explicitly select Default to stay on the default theme. To restore the original host appearance completely, also reset your custom colors yourself.

## Compatibility and troubleshooting

Requires a desktop host supporting declarative theme resources. The manifest requires NoteGen ≥ 0.37.1 and plugin API ^0.1.2; an older host build with the same app version may still lack the new resource contract. If no themes appear, check that the pack is enabled and the host supports this API. If colors do not change, check user overrides.

Theme names are bilingual literals because the current host theme selector displays resource names directly, without resolving translation placeholders for that field. This guide is included in the package. Host visual, installation, and accessibility checks have not been run; no contrast certification is claimed.
