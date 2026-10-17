# WaveDrom 预览

离线预览 WaveDrom 数字波形与时序图。

开发包由获批的构建生成在 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含通用代码块渲染 API 的 NoteGen 桌面宿主和修改后的本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

插件仅读取匹配的代码块，不访问工作区文件或网络。由宿主提供默认预览、源码切换、错误提示和渲染器选择。源码最多 32 KiB、1,000 行；SVG 输出最多 2 MiB，宿主还限制图像尺寸。按需加载引擎，插件之间无运行时依赖；不提供导出或移动端支持。

使用 WaveDrom 和 JSON5。仅支持包含 `signal` 的波形描述，以及分组、文字标题和连线；不使用上游基于 eval 的入口，不支持 `reg`、`assign`、自定义皮肤或富文本 JsonML 标签。最多 64 条信号，每条最多 256 个波形字符，分组最多 12 层，hscale 为 1–4。使用默认皮肤的白色画布，深色编辑器中也保留白底，确保波形可读。绘制前复制皮肤，绘制后将样式内联为 SVG 属性。

[使用说明](USAGE.md) · [English](README.en.md)

## 开发

获得构建授权后，在仓库根目录执行 `pnpm --filter @notegen/plugin-wavedrom build`。TypeScript 构建入口先编译到忽略的 `.notegen` 目录，再分别打包轻量适配器与独立引擎，收集实际打包依赖的许可证，最后生成 `.notegen/package` 开发目录。`plugin:pack` 不隐式构建。未新增 JavaScript 源文件或测试文件。
