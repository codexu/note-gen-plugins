# Document Preview

最低需要 **NoteGen 0.37.1**，并满足 `plugin.json` 声明的插件 API 版本。

NoteGen 官方本地只读文档预览插件。通过插件 API 0.1.2 的 `resources.documentPreviews`、隔离 iframe、`readDocument` 和 `readAsset` 接入。仅在桌面端运行，不使用宿主私有模块，不上传文档，不需要 LibreOffice。

[English](README.en.md) · [使用说明](USAGE.zh-CN.md)

## 已实现的范围

| 格式 | 界面与渲染 | 边界 |
| --- | --- | --- |
| PDF | PDF.js 原页面 canvas，翻页/指定页、25–300% 缩放、适合宽度、可选择文本层、跨页搜索与前后匹配、密码输入 | 无 OCR；不执行 PDF JavaScript，不启用 XFA，不提供交互表单/批注编辑；极大图像受限 |
| DOCX | docx-preview 的 HTML 排版：正文、图片、表格、页眉页脚、脚注尾注；缩放 | 字体、浮动对象、复杂排版和分页可能不同；不显示修订、批注和嵌入 HTML；不是 Word 完全等价版式 |
| XLSX | SheetJS Worker 解析，工作表切换（隐藏表有标识）、每次 100 行分段浏览、直接跳转行、横向滚动浏览列、单元格文本选择、公式悬停提示 | **数据浏览，不是 Excel 打印版式**；不重新计算公式，仅显示保存的缓存值；不还原合并单元格、图表、条件格式、图片、宏和外部数据连接 |
| PPTX | HTML/SVG 静态幻灯片；翻页、指定页、键盘导航、10–300% 缩放、适合窗口；页数上报 NoteGen 底部状态栏 | 不播放动画、转场、音视频；不承诺复杂 SmartArt、矢量图和字体完全还原；不支持老格式 PPT |

`.doc`、`.xls`、`.ppt`、`.xlsm`、`.docm` 等未注册，不会把提取文字或转 Markdown 作为这些格式的预览。扫描 PDF 没有 OCR 文本，故不能依赖搜索/选择文本。

## 依赖与分发

固定解析依赖：`pdfjs-dist@4.10.38`、`docx-preview@0.3.7`、`jszip@3.10.1`、SheetJS CE `0.20.3`（官方 CDN tarball）、`@aiden0z/pptx-renderer@1.2.4`。构建器是 `esbuild`，打包器使用工作区 `@notegen/plugin-cli`。

`node scripts/build.mjs` 将每个格式独立打成 classic IIFE，打包同版本 PDF Worker，并把 PDF CMaps 与标准字体合并为一个 base64 JSON 资源，避免超过每个预览最多 100 个资产的契约限制。XLSX 有独立解析 Worker；PDF 与 XLSX 的 Worker 从已校验的插件资源创建 blob URL。构建时收集所有打包输入所属依赖的许可，以及 PDF 字体/CMap 许可，生成随包 `THIRD-PARTY-NOTICES.txt`。脚本发现任何单个资源超过 5 MiB 会拒绝继续打包。

安装后的插件包包含上述渲染器、Worker、字体/CMap、许可和中英文 USAGE。**最终用户无需执行 npm install**。开发包已构建并通过 SDK 校验，尚未作为正式发布产物验收。PDF Worker 已改为本地打包的 classic Worker，以兼容 Chromium 的不透明源容器；资源路径保留 `dist/pdf.worker.mjs`，加载时不再使用 module 模式。

维护者在获准安装依赖和构建后，从仓库根目录执行：

```sh
pnpm install
pnpm --filter @notegen/plugin-document-preview build
pnpm --filter @notegen/plugin-document-preview plugin:pack
```

构建顺序必须先生成 `dist`，再调用 SDK 打包。`validate` 需要已生成的资源；源码首次检出时缺少 `dist` 是预期状态。安装目标为 `plugins/document-preview/.notegen/package`，开发导入需要开启宿主开发者模式；正式归档仍遵循仓库现有签名/发布流程。本轮未发布。

## 文件与资源限制

- 宿主一次最多读取 1 MiB、最多 2 个并发请求。本插件把文档和资产请求串行化，并设置 30 秒单次读取超时；只读取绑定的当前文件。
- PDF 上限 128 MiB，DOCX/XLSX/PPTX 上限 32 MiB。先按块读取，再组装给解析器；**不是流式/随机访问解析**，峰值内存会高于文件大小。宿主初始化未提供实际文件长度，EOF 以空块判断。
- Office ZIP 拒绝加密、ZIP64、分卷、重复/异常路径和明显损坏元数据；最多 4096 项、单项展开 32 MiB、XML 单项 16 MiB、合计展开 96 MiB、压缩比 200:1、最多 128 个 XLSX 工作表。
- ZIP 元数据预检不是进程级内存限额，伪造元数据或复杂文档仍可能使 WebView 卡顿。XLSX Worker 请求超 30 秒会终止；DOCX 库在 iframe 主线程排版，无法提供可靠的抢占式取消，应关闭该预览释放容器。
- XLSX 最多浏览前 100000 行与 256 列，越界时界面明确提示截断。单元格展示最多 32768 字符；公式提示最多 8192 字符。
- PDF 只保留当前页 canvas，像素数最多约 1600 万；搜索最多前 2000 页、5000 处匹配或累计 1600 万文本字符，达到上限时提示结果不完整。搜索忽略英文大小写；不做 OCR、模糊匹配、断词或跨页匹配。多栏/连字/分段文本受 PDF 文本提取顺序影响。
- 关闭/切换文件由宿主销毁 iframe 和 MessagePort；插件同时取消渲染、终止 Worker、清理挂起请求并撤销 blob URL。无持久化缓存。

## PPTX 实现

采用 [`@aiden0z/pptx-renderer@1.2.4`](https://github.com/aiden0z/pptx-renderer)，发布包包含 Apache-2.0 LICENSE；其 JSZip、ECharts 等传递依赖随插件打包并收集许可。仅打开 PPTX 时加载 `dist/pptx.js`，不增加 NoteGen 主安装包中的格式解析依赖。

按需解析幻灯片和媒体，只挂载当前一页。最多 300 页；展开媒体最多 64 MiB，解析并发为 2；另有通用 Office ZIP 限额。页面宽高必须为有限正数且不超过 20000 CSS px。关闭时清理渲染器、图表、blob URL 和尺寸观察器。解析与排版仍在 iframe 主线程，复杂文件可能卡顿，不能保证抢占式中断。

显式设置 `pdfjs: false`，禁用 EMF 内嵌 PDF 回退；不启用该可选功能，因此不使用此依赖声明的 PDF.js 5/6 可选 peer，保留现有 PDF 渲染器的 4.10.38。安装时可能出现该可选 peer 版本提示。文档链接、形状点击跳转和媒体播放被禁用，不放开网络 CSP。

本轮完成源码接入与依赖安装；未运行构建、测试、Lint 或类型检查，开发者导入包尚未包含 PPTX。既有 PDF 验证记录不代表 PPTX 已通过验收。

## 宿主契约与验证状态

已静态核对当前 `.sdk/RESOURCE-EXTENSIONS.md`、API 资源类型、SDK 资源打包逻辑，以及宿主 `plugin-document-preview.tsx`。宿主已有所需读取/隔离/资源契约；本次在宿主初始化消息中补充 locale，无需修改 SDK。权限使用 `workspace-folder`，默认授权路径 `.` 即整个工作区；预览协议仍将读取绑定到当前打开文件，渲染器不能自行指定其他路径。

初始化消息通过 `locale` 传入 NoteGen 界面语言，切换语言会重载预览；未支持的语言或旧宿主缺少该字段时回退英文。主题和文档实际大小仍未传入，颜色使用系统深浅色偏好；Office/PDF 页面保留文档纸张颜色。插件不会自行读取系统语言或父窗口状态。

2026-09-11 本地验证：依赖安装、插件构建及 SDK 校验通过。使用宿主实际生成的双层隔离 HTML 和插件脚本，在独立 WebKit/Chromium 测试页中验证两页 PDF 的实际画布内容、文本层、翻页及跨页搜索通过。文件读取由测试桥提供，不等同于已通过真实 NoteGen 导入和用户文件验收。宿主已修复桌面读取命令注册、外层 iframe 创建 blob、CSP 继承和初始化时序。

仍待桌面验收：权限授予/拒绝/撤销；长文档、中文字体、扫描/加密/损坏 PDF；搜索中切页/关闭；含图片表格/复杂分页的 DOCX；含公式缓存/空表/隐藏表/超限数据的 XLSX；断开网络；禁用/卸载/更新与工作区切换。未运行 Lint 或类型检查，未发布。

## 共享集成待办

本轮仅改本目录。统一集成时更新根 `pnpm-lock.yaml`（上述依赖）、根 README 的插件列表和 `market/registry.json` 的官方条目。无需新增根 package.json 配置，现有 `plugins/*` 工作区自动发现本插件。市场条目应在构建、签名及桌面验收后指向真实产物，不填写虚构校验和或下载地址。
