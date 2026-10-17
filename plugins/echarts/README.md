# ECharts 图表

离线预览 ECharts JSON 图表。

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用 ECharts 6 的 SVG SSR 渲染，画布为 720×420。只解析 JSON option，不执行 JavaScript、formatter/renderItem 函数或扩展脚本。支持常见静态图表；不支持地图、custom、lines、effectScatter、外部图片、链接、网络数据、动画或交互。显式 animation/universalTransition 只能为 false；每个数组最多 5,000 项，最多嵌套 32 层。

[使用说明](USAGE.md) · [English](README.en.md)

## 开发

获得构建授权后，安装工作区依赖、构建本地 SDK，再执行 `pnpm --filter @notegen/plugin-echarts build`。共享 TypeScript 入口打包适配器和独立引擎、收集许可证，最后生成 `.notegen/package` 开发目录。没有新增 JavaScript 源文件或测试文件。
