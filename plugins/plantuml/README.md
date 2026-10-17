# PlantUML 预览

为 NoteGen 的 `plantuml` 和 `puml` Markdown 围栏代码块提供离线图表预览。用户按需安装，NoteGen 主程序不携带 PlantUML 引擎。

本目录是开发源码，已生成本地可导入开发包，尚未进行运行验证或发布。需要包含通用代码块渲染扩展点的 NoteGen 宿主，以及本次修改后的 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

- 仅读取其匹配代码块，源码仍保存在原 Markdown 文件中。
- 使用固定版本 `@plantuml/core@1.2026.9`，无需 Java、Graphviz 程序、CDN 或服务器。
- 支持基础图表、包内主题、emoji/OpenIconic 资源和明暗主题。
- 由宿主统一提供预览、源码编辑、错误反馈和多个渲染器的默认选择。
- 不提供 `!include`、外部标准库、文件引用、网络图片、交互式图表或图表导出。
- 最多预览 32 KiB、1,000 行源码；输出受宿主尺寸和体积限制。

浏览器版 PlantUML 依赖 DOM 测量，运行于宿主共享的隔离 iframe。iframe 不保证独立线程；复杂图表性能仍待桌面实测。当前插件宿主只启用桌面端，本插件不声明移动端支持。

[使用说明](USAGE.md) · [English](README.en.md)

## 开发与资源

遵循仓库的阶段审批流程。获得验证授权后，先构建修改后的 SDK，再安装本工作区依赖并执行插件构建。构建脚本为 TypeScript，先由现有 esbuild 编译到忽略目录 `.notegen` 再运行，沿用仓库的 Node >=20 环境。`build` 打包轻量渲染适配器并复制完整的上游引擎、布局引擎、主题、emoji、OpenIconic 和许可证，然后交给 CLI 生成开发包。

`plugin:pack` 使用已经生成的资源，不会隐式构建。已完成所需 SDK 包及插件构建，开发包位于 `.notegen/package`；未执行 `plugin:pack` 或发布。没有新增 JavaScript 源文件、测试文件、发布资产或已签名市场索引。

上游核心采用 MIT 许可；插件采用仓库的 GPL-3.0-or-later。`dist/THIRD-PARTY-NOTICES.txt` 在构建时保留上游许可证，适配器打包保留依赖许可注释。
