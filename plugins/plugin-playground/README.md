# Plugin Playground

[English](README.en.md) · [中文使用说明](USAGE.zh-CN.md)

覆盖 NoteGen 当前公开插件 API 的官方交互实验室，可用于手动回归测试和插件开发参考。实现以本地 `.sdk/packages/plugin-api/src/index.ts` 为契约，并对照 NoteGen 宿主的 broker 与声明式 UI 限制编写，不依赖应用内部模块、DOM、Node.js、文件系统或直接网络访问。

## 文件结构

- `src/main.ts`：生命周期、命令注册、串行调度、声明式 UI、表单与事件。
- `src/operations.ts`：32 项独立能力示例、测试文件所有权、分页游标和版本保护。
- `plugin.json`：全部 12 项公开权限、四类激活事件、菜单、设置、状态栏、三种视图。
- `locales/`：中英文清单与运行时文本。
- `USAGE*.md`：随插件包分发的操作说明与手工验收步骤。

## 能力对照

| 公开接口／贡献点 | 示例入口 |
| --- | --- |
| `plugin.id/version/apiVersion`、`i18n.t`（含插值） | 插件信息、工作区与国际化 |
| `activate/deactivate`、`signal.aborted/reason/throwIfAborted/addEventListener/removeEventListener`、`PluginDisposable.dispose` | 激活、取消、清理订阅；停止后不再发布结果 |
| `commands.handle`、JSON 参数／返回值 | 所有按钮、表单、表格单元格、树节点；故意异常命令 |
| `commands.executeHost` | 主面板底部三种宿主导航 |
| `workspace.getCurrent/onDidChange` | 环境信息与工作区切换记录 |
| `calendar.resolveDay` | 时区设置与 04:00 逻辑日界线、无效时区探针 |
| `notes.openOrCreate` | 创建、打开、幂等键与保留现有内容 |
| `notes.read/list/search` | 文件读取、递归目录、分页游标、搜索 |
| `notes.write/move/delete/onDidChange` | 创建、revision 追加、过期写入保护、移动、删除、笔记事件 |
| `attachments.create/read` | 唯一路径 TXT 附件创建与 Base64 读取 |
| `editor.getActiveEditor/getSelection/getTextSnapshot` | 侧栏读取编辑状态、选区和快照 |
| `editor.applyEdit/applyEdits/setSelection` | 光标／选区替换、源码批量编辑、UTF-16 选区 |
| 两种编辑器事件 | 活动编辑器切换与内容变化日志 |
| `storage.device/workspace.get/set/delete` | JSON 保存、读取、删除；重启与工作区切换检查 |
| `settings.get/onDidChange` | 六种设置类型、设备与工作区作用域、修改事件 |
| `ui.showNotice/statusBar.update` | 通知、文字、紧凑文本、无障碍标签、忙碌与可见状态 |
| `ui.views.update/open/close/focus/getState/onDidChange` | 左侧栏、右侧栏、编辑器标签页及其控制与事件 |
| `ui.openDialog/updateDialog/closeDialog/onDidCloseDialog` | 创建、校验、更新、替换、关闭与关闭原因 |
| 全部 11 种 `PluginUiBlock` | heading/text/list/key-value/actions/form/separator/callout/progress/table/tree（含完整 form 交互） |
| 表单字段与反馈 | text/textarea/number/select/checkbox、required/disabled/visibleWhen、fieldErrors/message、resetKey、changeCommand、expectedForm |
| `network.fetch` | 固定公共 HTTPS GET、超时、请求头、响应状态／头／正文 |
| 四类激活事件 | `onCommand:*`、`onEditor:markdown`、`onWorkspace:open`、`onNotes:change` |
| 四类菜单位置 | 斜杠、编辑器右键、文件右键、移动写作菜单 |
| 公开权限 | 12 项权限均为 optional，支持缺少授权时逐项观察错误 |

上述覆盖以公开运行时接口及贡献点为范围，并不代表枚举每个参数值、权限范围组合或内部实现细节。网络只演示 GET；权限按活动编辑器、测试目录和网络来源授予；不使用该示例对任意网络服务发起修改请求。

## 构建与打包

在仓库根目录、SDK 依赖已安装的前提下：

```bash
pnpm --filter @notegen/plugin-playground build
pnpm --filter @notegen/plugin-playground validate
pnpm --filter @notegen/plugin-playground plugin:pack
```

开发包输出到 `.notegen/package`；签名和发布使用本仓库统一流程。本插件已登记为 official、非 featured，源码登记不代表市场发布。

已通过插件构建（含 TypeScript 检查）、生成包校验及针对 NoteGen 0.37.0 的清单兼容性检查；开发包包含中英文使用说明。已通过权限拒绝、测试文件操作和弹窗校验的自动回归测试；尚未运行 Lint 或导入宿主实测。手工验收步骤见使用说明；计数器不等于自动回归测试套件。签名／完整性失败、版本兼容、资源配额与沙箱超时应由 SDK 和宿主专门测试验证。
