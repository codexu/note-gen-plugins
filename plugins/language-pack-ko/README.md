# 韩语语言包

最低需要 **NoteGen 0.37.1**，并满足 `plugin.json` 声明的插件 API 版本。

[English](README.en.md) · [한국어 사용 안내](USAGE.ko.md)

NoteGen 官方独立韩语语言资源包。启用后在界面语言列表中新增 **한국어**，不会移除或覆盖任何内置语言。一个安装包只提供一种语言，不需要安装其他语言包。

| 项目 | 值 |
| --- | --- |
| 插件 ID | `top.notegen.language-pack-ko` |
| npm 工作区包名 | `@notegen/plugin-language-pack-ko` |
| 显示名称 | `Korean Language Pack · 한국어` |
| 语言代码 | `ko` |
| 版本 | `0.1.0` |
| 平台 | NoteGen 桌面端 |
| 宿主 | `0.37.1` 起，且必须实现资源扩展协议 `0.1.2` |

## 安装与使用

安装并在当前工作空间启用插件后，打开「设置 → 通用设置 → 界面设置 → 语言」，选择 **한국어**。具体操作见随包的 [中文使用说明](USAGE.zh-CN.md)、[英文使用说明](USAGE.md) 和 [韩文使用说明](USAGE.ko.md)。

这是源码，尚未构建、打包、签名或发布到市场。开发导入需先使用当前 SDK 构建，然后在 NoteGen 开发者模式下导入本目录的 `.notegen/package`。旧版不支持资源扩展的宿主不能仅凭 `0.37.1` 版本号认定兼容。

## 翻译范围

资源位于 `messages/ko.json`，与宿主 `messages/en.json`、`messages/zh.json` 以及 `messages/common/*.json` 的嵌套结构一致；公共文案位于 `common` 内，而不是另注册一种语言。覆盖设置、插件管理、记录、AI 对话、同步、知识库、画布、编辑器、文件管理、窗口和公共操作。包含宿主消息树中的移动端文案，但当前资源契约仅在桌面端注册。

基线有 4,227 个字符串字段，本包提供基线中的 4,225 个字段，并额外补充语言插件发现入口文案，共 4,226 个字段。两个 Mermaid ER 代码模板保留宿主回退：`settings.editor.mermaid.templates.er` 和 `editor.mermaid.templates.er`。它们是相同的非韩语代码示例；中文原值中的 `o{` 被当前宿主 ICU 解析器视为不完整参数。即便语言包转义译文，宿主仍会解析原值而拒绝启用，因此这里不重复声明它们。其余代码模板保持可执行语法，产品名、路径、命令和技术标识保留原样。

基线来源和回退字段记录在 [translation-baseline.json](translation-baseline.json)。宿主图片保存提示的 `__PATH__` 是字符串替换标记，按实际调用方式保留，不替换成英文源中的 ICU `{path}`。

ICU 参数名不翻译；保留复数分支、`#`、换行及字面量占位符引号。韩语计数表达使用统一量词，`one` / `other` 都提供对应内容。翻译以本地机器翻译辅助起稿，再修订常用界面、术语、参数消息和技术示例；仍需韩语母语者在实际界面中进行语言质量审阅。字段齐全不等于已经通过人工逐条或运行验收。

## 声明式契约与生命周期

清单只声明 `resources.languages`，没有 JavaScript `entry`、运行时贡献、激活事件或权限，也没有运行时依赖。宿主通过完整性保护的安装流程读取 JSON，启用时注册，停用或卸载时撤销注册；本包不访问私有模块，不改宿主文件。

- 选择语言后由宿主刷新消息，不需插件自行重启应用。
- 新增或遗漏字段由宿主回退至默认简体中文；不会用英文副本伪装韩语覆盖。
- 停用或卸载后韩语选项消失；没有其他韩语提供者时显示内置默认语言，保存的 `ko` 选择仍保留，再次启用后可以恢复。
- 内置中文、英语、日语、葡萄牙语、繁体中文和德语始终保留。
- 相同语言有多个提供者时，插件 ID 按字典序靠前的提供者在重叠字段上优先。

契约也支持覆盖内置语言：另建一个资源包，将 `locale` 设置为已有的代码，例如 `en`，并提供同结构的部分消息：

```json
{
  "resources": {
    "languages": [
      { "locale": "en", "name": "English", "messages": "messages/en.json" }
    ]
  }
}
```

对应 `messages/en.json` 可以是 `{"common":{"save":"Save changes"}}`。缺失字段先回退内置英语，再回退中文；移除该包恢复内置译文。这个片段只是契约用法说明，本韩语包没有声明任何内置语言覆盖。`resources.languages` 与插件自身贡献文案使用的 `defaultLocale/locales` 是不同用途。

## 统一命名规则

每种语言一个包，采用 `language-pack-<locale-slug>`：

| 项目 | 规则 | 韩语例子 |
| --- | --- | --- |
| 语言代码 | 标准 BCP 47 写法 | `ko` |
| slug | 语言代码转小写，保留连字符 | `ko`；地区示例 `pt-br` |
| 插件 ID | `top.notegen.language-pack-<slug>` | `top.notegen.language-pack-ko` |
| 包名 | `@notegen/plugin-language-pack-<slug>` | `@notegen/plugin-language-pack-ko` |
| 显示名 | `<English language name> Language Pack · <本地语言名>` | `Korean Language Pack · 한국어` |
| 语言选择器 | 本地语言名 | `한국어` |
| 资源路径 | `messages/<BCP47>.json` | `messages/ko.json` |

每种语言使用独立源码目录 `plugins/language-pack-<slug>`。韩语位于 `plugins/language-pack-ko`；未来法语位于 `plugins/language-pack-fr`，对应 `top.notegen.language-pack-fr`，独立构建、安装、启用和卸载。

## 开发与集成

开发依赖仅 `@notegen/plugin-cli: workspace:^`（当前 `.sdk` 的 CLI `0.1.3` 源码支持无入口资源包），无 `@notegen/plugin-api` 或 TypeScript 运行时依赖。安装工作区依赖后，可按需执行：

```bash
pnpm --filter @notegen/plugin-language-pack-ko build
pnpm --filter @notegen/plugin-language-pack-ko validate
pnpm --filter @notegen/plugin-language-pack-ko run plugin:pack
```

CLI 会把清单引用的语言 JSON 和 `USAGE*.md` 放入完整性保护的包。本轮没有执行上述命令、测试、Lint、类型检查或宿主运行验收；只做源码契约与翻译数据静态审阅。

共享文件由统一集成处理：更新 `pnpm-lock.yaml` 的工作区 importer，向根双语 README 加入语言包，在 `market/registry.json` 按现有约定登记独立插件。`pnpm-workspace.yaml` 已有 `plugins/*`，无需新增通配规则。发布前还需实际构建打包、安装启用、切换语言、重启恢复、缺失字段回退、停用/卸载和重新启用验收。
