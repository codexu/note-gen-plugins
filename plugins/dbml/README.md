# DBML 数据库关系图

离线预览 DBML 数据表、字段与关联关系。

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用官方 @dbml/parse 解析当前代码块，通过 Dagre 在独立 Worker 中布局。显示表名、字段类型、主键/非空标记和外键连线及基数；支持独立 Ref 与行内 ref。最多 50 张表、500 个字段、200 条关系，单行标签最多 100 字符。不访问数据库、不运行 SQL，不加载外部 DBML 文件；注释、记录、索引和分组信息不作为独立图形显示；首期不展开 TablePartial，请直接在表中声明字段。

[使用说明](USAGE.md) · [English](README.en.md)

## 开发

获得构建授权后，安装工作区依赖、构建本地 SDK，再执行 `pnpm --filter @notegen/plugin-dbml build`。共享 TypeScript 入口打包适配器和独立引擎、收集许可证，最后生成 `.notegen/package` 开发目录。没有新增 JavaScript 源文件或测试文件。
