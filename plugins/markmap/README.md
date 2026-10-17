# Markmap 思维导图

将 Markdown 大纲离线预览为静态 Markmap 思维导图。

开发包由获批的构建生成在 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含通用代码块渲染 API 的 NoteGen 桌面宿主和修改后的本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

插件仅读取匹配的代码块，不访问工作区文件或网络。由宿主提供默认预览、源码切换、错误提示和渲染器选择。源码最多 32 KiB、1,000 行；SVG 输出最多 2 MiB，宿主还限制图像尺寸。按需加载引擎，插件之间无运行时依赖；不提供导出或移动端支持。

使用 Markmap 的无扩展解析器处理 Markdown 标题和列表，再用 d3-hierarchy 生成静态树形布局。支持 `markmap`。为兼容宿主纯 SVG 安全过滤，标签只输出文字，基础行内格式简化为文字，不提供折叠、缩放、可点击链接、图片、公式、外部样式和脚本，也不应用 frontmatter 选项。最多 400 个节点、20 层，每个标签最多 500 字符；超出宿主尺寸限制时需要拆分大纲。

[使用说明](USAGE.md) · [English](README.en.md)

## 开发

获得构建授权后，在仓库根目录执行 `pnpm --filter @notegen/plugin-markmap build`。TypeScript 构建入口先编译到忽略的 `.notegen` 目录，再分别打包轻量适配器与独立引擎，收集实际打包依赖的许可证，最后生成 `.notegen/package` 开发目录。`plugin:pack` 不隐式构建。未新增 JavaScript 源文件或测试文件。
