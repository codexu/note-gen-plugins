# 本地验证记录 · 2026-09-11

本轮用户授权本地构建及 NoteGen 开发者导入测试。

## 已完成

- 为 Iconize 安装缺失开发依赖，使用 `--ignore-scripts --lockfile=false`，没有更新共享锁文件。
- `pnpm --filter @notegen/plugin-iconize build` 通过，包含 TypeScript 检查与 SDK CLI 构建。
- 构建发现普通 `actions` 不支持 `icon` 属性，已将操作栏改为公开 `toolbar` 结构；修复后重新构建通过。
- `notegen-plugin validate plugins/iconize/.notegen/package --app-version 0.37.0 --api-version 0.1.2` 通过。
- 对生成的实际 bundle 使用 SDK 内存测试宿主完成：激活与声明式 UI 校验、扩展名归一化、Emoji 指定、指定优先于扩展名、移动事件跟随与重复事件幂等、停用规则、拒绝过期列表操作、存储恢复。

内存测试不验证原生文件系统、真实界面渲染、跨窗口同步或宿主图标清理。

## 桌面测试状态：待继续

检测到已有 `pnpm tauri dev`、`target/debug/note-gen` 进程及监听 3456 的开发服务，未重复启动或停止其他进程。

桌面控制工具的应用清单未列出裸 Tauri 开发进程；按 NoteGen 名称和开发版 app 路径连接均超时，bundle ID 返回多个安装位置歧义，直接可执行文件路径不被工具接受。尚未成功进入开发者导入界面，因此**未完成实际导入、树/标签页视觉一致性、拖拽、启停或工作区切换的桌面验收**。已请用户将运行中的 NoteGen 开发窗口切到前台以继续连接。

开发者导入目录：`/Users/xu/code/note-gen-plugins/plugins/iconize/.notegen/package`。目录包含 `plugin.json`、`integrity.json`、bundle、双语 locales 与 USAGE。

## 设置页迁移验证

- 新增 `contributes.views[].location: settings`，协议提升为本地未发布的 0.1.4；Iconize 要求 `^0.1.4`，旧宿主不能导入新包。
- SDK API、CLI、测试宿主构建通过；协议一致性检查通过；设置视图共享可见性和拒绝旧协议的 2 项定向测试通过。
- Iconize 类型检查、构建，以及针对协议 0.1.4 / NoteGen 0.37.0 的开发目录校验通过。
- NoteGen 插件 worker 构建通过。宿主 TypeScript 检查仅剩已有 `src/lib/theme-utils.ts:31` 的 `HSLValue` 不能赋给 `never` 错误，未修改这个主题模块。
- 本地宿主 `node_modules/@notegen/plugin-api` 临时链接到 `/Users/xu/code/note-gen-plugin-sdk/packages/plugin-api`，以使用未发布协议；没有改宿主依赖声明。重新安装依赖可能覆盖该链接。
- 真实桌面导入、设置页渲染和右键跳转仍待验收。需要运行包含本次 Rust 校验变更的 Tauri 开发版，并重新导入当前 `.notegen/package`。
