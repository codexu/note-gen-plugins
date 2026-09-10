# Daily Notes

[English](README.en.md)

NoteGen 官方每日笔记插件。执行命令时，它会按照当前工作区设置的时区解析
逻辑日期，并打开已有笔记或创建一篇新笔记。

- 插件 ID：`top.notegen.daily-notes`
- 版本：`0.1.0`
- 平台：NoteGen Desktop
- 最低 NoteGen 版本：`0.37.0`

## 功能

- 自定义每日笔记目录和文件名；
- 使用内置正文模板，或读取工作区内的 Markdown 模板文件；
- 同一天重复执行时打开已有文件，不重复创建；
- 支持英语和简体中文界面文本。

目录和文件名可使用：`{{date}}`、`{{year}}`、`{{month}}`、`{{day}}`。
正文模板还可使用：`{{dateLong}}`、`{{weekday}}`、`{{time}}`、
`{{title}}`、`{{path}}`、`{{workspaceName}}`。

## 权限

| 权限 | 用途 |
| --- | --- |
| `notes.create` | 在配置的工作区目录创建每日笔记 |
| `notes.open` | 打开新建或已经存在的每日笔记 |
| `notes.read`（可选） | 读取用户在设置中选择的 Markdown 模板文件 |

首次启用时，需要为 `notes.create` 和 `notes.open` 填写允许访问的基础目录。
默认配置填写 `Daily` 即可，年份和月份目录会在其下创建；填写 `.` 会授权整个
工作区，不建议在没有必要时使用。启用模板文件后，只为 `notes.read` 授权该文件。

修改目录或模板文件设置不会自动改写已有授权。新路径超出当前授权时，插件会
拒绝操作；请在 NoteGen 的插件权限页重新审核路径，并手动撤销不再需要的旧授权。

插件不会访问网络。所有内容都留在当前 NoteGen 工作区。

## 开发

仓库根目录安装依赖后执行：

```bash
pnpm --filter @notegen/plugin-daily-notes build
pnpm --filter @notegen/plugin-daily-notes validate
pnpm --filter @notegen/plugin-daily-notes run plugin:pack
```

开发构建输出到 `.notegen/package`，未签名归档输出到
`.notegen/releases`。插件市场尚未发布签名索引，因此当前源码不代表已经可以
从 NoteGen 市场安装。

## 界面展示

在支持界面展示设置的 NoteGen 中，打开「设置 → 插件 → 已安装 → 此插件的设置 → 界面展示」，可分别控制：文件右键菜单、标签页右键菜单、斜杠命令菜单。默认展示，修改立即生效，按当前设备保存并适用于此设备上的所有工作区。

隐藏入口不会停用插件或删除数据，仍可从命令面板执行命令。隐藏侧栏或编辑器 Tab 后，插件不会自动重新打开该视图；需要查看时先重新开启对应展示开关。
