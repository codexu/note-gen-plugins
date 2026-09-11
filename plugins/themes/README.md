# NoteGen Themes · 官方主题包

最低需要 **NoteGen 0.37.1**，并满足 `plugin.json` 声明的插件 API 版本。

[English](./README.en.md) · [使用说明](./USAGE.zh-CN.md)

一个声明式资源包，包含纸墨、松林、海岚三组原创配色，各自提供完整亮暗方案。复用 SDK 的 `resources.themes` 与宿主主题选择、注册和清理机制，不复制宿主的自定义主题编辑器或内置预设。

| 主题 ID | 显示名称 | 配色 |
| --- | --- | --- |
| `paper-ink` | 纸墨 · Paper & Ink | 暖纸色、棕墨主色；暗色为暖炭灰 |
| `pine` | 松林 · Pine | 灰绿底色、松绿主色；暗色为深绿灰 |
| `sea-mist` | 海岚 · Sea Mist | 冷灰底色、蓝色主色；暗色为深蓝灰 |

六套配色均定义 SDK 允许的全部 16 个 HSL 变量。浅色主按钮采用深底浅字，暗色主按钮采用浅底深字；辅助文字和悬停表面各有独立配色。没有 JavaScript 入口、运行时依赖、权限、任意 CSS、外部字体或远程资源。

插件 ID：`top.notegen.themes`；版本：`0.1.0`；桌面宿主最低版本：`0.37.1`；插件 API：`^0.1.2`。资源名称通过语言文件翻译，使用支持资源名称本地化的 NoteGen 客户端时跟随界面语言。中英文 USAGE 会由 CLI 自动收进安装包。

## 开发与打包

在仓库根目录安装工作区依赖后，可按需执行：

```sh
pnpm --filter @notegen/plugin-themes validate
pnpm --filter @notegen/plugin-themes build
pnpm --filter @notegen/plugin-themes plugin:pack
```

构建目录为 `plugins/themes/.notegen/package`，通过宿主开发者页面导入它的绝对路径。打包命令也会构建，输出 `plugins/themes/.notegen/releases/top.notegen.themes-0.1.0.unsigned.notegen-plugin`。这是未签名开发产物；正式市场包应遵循仓库统一签名发布流程。

唯一开发依赖为 `@notegen/plugin-cli`（`workspace:^0.1.3`），使用 `.sdk` 指向的 `/Users/xu/code/note-gen-plugin-sdk`。无 TypeScript 源码，不需要单独添加 TypeScript 或运行时 API 依赖。

## 接入依据与验证状态

实现依据是 SDK 的 `PluginThemeResource`、`PLUGIN_THEME_TOKENS`、资源包示例和 CLI 无入口打包流程。宿主 `resources.ts` 注册及清理资源，主题选择器选择 `插件 ID:主题 ID`；颜色合成由宿主执行，优先级为默认色、主题包、用户覆盖。禁用卸载会移除资源，但不会删除用户覆盖或宿主记忆的选择；详见随包使用说明。

本轮仅阅读源码并静态审阅文件，按要求未执行测试、Lint、类型检查、构建或打包。尚无本轮生成的可安装产物，也未实际验证宿主安装、切换、重新启用、卸载及视觉效果。后续获准验证时，应覆盖三组主题的明暗切换、系统模式、自定义色覆盖与重置、禁用后的回退及重新启用恢复。

## 待统一集成

本任务只新增 `plugins/themes`。`plugins/*` 已被工作区包含，根 package.json 和工作区配置无需调整。需统一更新 pnpm-lock.yaml 的本插件导入项，并在 market/registry.json 注册本目录及中英文市场文案，再按发布流程生成目录、签名和产物。可用市场描述：中文「纸墨、松林、海岚三组明暗主题，兼容用户自定义配色。」；英文「Three paired light/dark themes that respect your custom colors.」。根中英文 README 的官方插件列表可同步补充本包。
