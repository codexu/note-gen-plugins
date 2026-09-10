# Editor Statistics

[English](README.en.md)

NoteGen 官方编辑器统计插件。它在本地解析活动 Markdown 编辑器的快照，并在
状态栏显示字符数、单词数和预计阅读时间。

- 插件 ID：`top.notegen.editor-statistics`
- 版本：`0.1.0`
- 平台：NoteGen Desktop
- 最低 NoteGen 版本：`0.37.0`

## 功能

- 统计含空白与不含空白的字符数；
- 分别统计 CJK 字符和非 CJK 单词；
- 按每分钟 300 个 CJK 字符、200 个非 CJK 单词估算阅读时间；
- 识别 Markdown 结构，可选择是否把代码块计入字符数；
- 通过编辑器事件实时更新，超大文档改为手动刷新；
- 支持英语和简体中文界面文本。

URL、数学公式、Front Matter 和任务列表标记不会计入正文阅读统计。所有计算
都在插件运行环境内完成，内容不会发送到网络。

## 权限

| 权限 | 用途 |
| --- | --- |
| `editor.read` | 读取当前活动 Markdown 编辑器的文本快照 |

## 开发

仓库根目录安装依赖后执行：

```bash
pnpm --filter @notegen/plugin-editor-statistics build
pnpm --filter @notegen/plugin-editor-statistics validate
pnpm --filter @notegen/plugin-editor-statistics run plugin:pack
```

`markdown-it` 会由 `@notegen/plugin-cli` 打包进独立入口文件，运行时只通过
`@notegen/plugin-api` 的公开能力访问 NoteGen。插件市场尚未发布签名索引，
因此当前源码不代表已经可以从 NoteGen 市场安装。

## 界面展示

在支持界面展示设置的 NoteGen 中，打开「设置 → 插件 → 已安装 → 此插件的设置 → 界面展示」，可分别控制：状态栏。默认展示，修改立即生效，按当前设备保存并适用于此设备上的所有工作区。

隐藏入口不会停用插件或删除数据，仍可从命令面板执行命令。隐藏侧栏或编辑器 Tab 后，插件不会自动重新打开该视图；需要查看时先重新开启对应展示开关。

原有「显示状态栏」设置仍按工作区生效；状态栏只有在该设置与设备级展示开关均开启时才会显示。刷新和查看详情命令不受展示开关影响。
