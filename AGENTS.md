# 工作规则

- 直接在 `/Users/xu/code/note-gen-plugins` 的 `main` 分支开发。
- 不创建或使用额外 worktree，不自动创建功能分支，除非用户明确要求。
- 本地 `.sdk` 指向 `/Users/xu/code/note-gen-plugin-sdk`，不再使用带 `-complete` 或 `-official` 后缀的旧目录。
- 保留已有未提交改动；未经明确要求，不提交或推送。
- 修改后不主动运行测试、Lint、类型检查或构建，除非用户明确要求。
- 每个官方插件至少完整提供 `en` 和 `zh-CN`，名称、介绍和声明式设置文案使用语言键，默认语言为 `en`，显示语言跟随 NoteGen。同步维护中英文 README 与 USAGE；市场名称和介绍与插件语言文件保持一致。详见 README 的「官方插件语言规范」。
