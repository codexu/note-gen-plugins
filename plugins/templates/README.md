# 动态模板（官方插件）

最低需要 **NoteGen 0.37.1**，并满足 `plugin.json` 声明的插件 API 版本。

[English](README.en.md) · [使用说明](USAGE.zh-CN.md)

基于 Markdown 文件的动态模板：递归模板目录、日期时间/标题/选中文本变量、自定义字段表单、预览确认、插入当前笔记和从模板新建笔记。内置中英文会议纪要、日报、读书笔记。第一版使用自身语法，不兼容 Obsidian API，也不执行系统命令。

插入通过公开 `editor.applyEdits` 固定位置和修订号进行，仅支持源码模式；选区不被替换。创建通过 `notes.openOrCreate` 保留同名文件内容。对话框关闭、工作区切换和失效提交均有保护。确认后已发出的宿主写入不可取消，详见使用说明。

## 开发与依赖

- 插件 ID：`top.notegen.templates`；版本 `0.1.0`；API `^0.1.4`；桌面端。
- 复用仓库 `shared/workbench.ts` 的 `record`、`string`、`notePath`，自有对话框会话管理用于取消和提交校验。
- 开发依赖：`@notegen/plugin-api`、`@notegen/plugin-cli`（工作区依赖）、TypeScript `^5.8.3`；无额外运行时依赖。
- `templates/**/*.md` 是内置模板源文件。`scripts/sync-templates.mjs` 将它们写入已纳入版本管理的 `src/bundled.ts`；构建及打包脚本先同步，再由 SDK CLI 打成单入口。使用说明和 locales 由 SDK CLI 随包收集。
- 源码、生成模板、清单和文档已静态审阅；本轮未执行测试、Lint、类型检查、构建或安装。

获明确授权后可在仓库根目录运行：

```sh
pnpm --filter @notegen/plugin-templates build
pnpm --filter @notegen/plugin-templates validate
pnpm --filter @notegen/plugin-templates plugin:pack
```

## 集成事项

本轮仅修改 `plugins/templates`。根工作区 `plugins/*` 已覆盖该包；后续统一刷新 `pnpm-lock.yaml`，添加根 README 插件索引及 `market/registry.json` 条目，获得授权后执行构建、验证和市场产物流程。不要将源文件目录直接视为已打包发行产物。

公开接口限制：固定范围编辑仅支持源码模式；清单只允许一个设置绑定文件夹权限，因此自动绑定新笔记目录，模板读取目录由安装授权界面设置。不需要 SDK 或宿主改动即可使用已实现功能。

## 创建入口更新

插件专属设置页新增两种自定义方式的说明与「创建模板」按钮，模板选择窗口也可进入。向导通过表单配置自定义字段，自动生成 Markdown 文件；手写模板仍然保留。创建向导使用可选的 `notes.write` 模板目录权限，只发送新建请求。此次更新未执行测试或构建，现有开发导入产物需要重新构建后才能包含该功能。
