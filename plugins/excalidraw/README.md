# Excalidraw 草图预览

将 Excalidraw JSON 场景离线预览为静态草图。

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用官方 @excalidraw/utils 导出完整 Excalidraw JSON 场景，只预览矩形、椭圆、菱形、线、箭头、自由笔画和文字。不提供画布编辑、图片/附件、嵌入内容、链接、框架或场景迁移。最多 400 个元素、每个点数组最多 5,000 项；输入仍受 32 KiB 限制。导出场景需含完整元素属性与 seed。文字统一使用系统无衬线字体，手写字体和换行效果可能与官方编辑器不同。上游导出模块较大，构建时压缩成四个资源分片，首次使用时解压加载；需要支持 DecompressionStream 的现代桌面 WebView。开发包约 13.3 MiB，解压后的引擎脚本约 19 MiB；首次加载成本与运行内存尚未在应用内实测。

[使用说明](USAGE.zh-CN.md) · [English](README.en.md)

## 开发

获得构建授权后，安装工作区依赖、构建本地 SDK，再执行 `pnpm --filter @notegen/plugin-excalidraw build`。共享 TypeScript 入口打包适配器和独立引擎、收集许可证，最后生成 `.notegen/package` 开发目录。没有新增 JavaScript 源文件或测试文件。
