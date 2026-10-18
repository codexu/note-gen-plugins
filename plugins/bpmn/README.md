# BPMN 流程图

离线预览包含布局信息的 BPMN 2.0 XML 流程图。

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用 bpmn-js Viewer，只接受包含 BPMNDiagram/BPMNPlane、BPMNShape 坐标和 BPMNEdge 路径的 BPMN 2.0 XML；只有业务定义、没有 DI 布局的 XML 不会自动布局。最多 300 个形状、600 条连接。不执行流程、脚本或外部调用，不提供流程编辑。拒绝 XML DTD/实体。静态图片底部保留原始 bpmn.io 标识，输出字体/样式会在隔离环境中转为 SVG 属性，明暗主题提供默认配色。

[使用说明](USAGE.zh-CN.md) · [English](README.en.md)

## 开发

获得构建授权后，安装工作区依赖、构建本地 SDK，再执行 `pnpm --filter @notegen/plugin-bpmn build`。共享 TypeScript 入口打包适配器和独立引擎、收集许可证，最后生成 `.notegen/package` 开发目录。没有新增 JavaScript 源文件或测试文件。
