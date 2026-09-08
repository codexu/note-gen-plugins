# NoteGen Plugins

[English](README.en.md)

NoteGen 社区插件市场的登记、审核与静态分发仓库。

> [!IMPORTANT]
> 仓库已经公开，但远程市场和社区投稿尚未开放。目前没有可供
> NoteGen 消费的签名索引、签名文件或社区插件包。请不要按自定义目录或
> JSON 格式提交插件，也不存在“提交 Pull Request 即上架”的流程。

## 仓库职责

市场正式开放后，本仓库计划承载：

- 社区插件与发布者的登记来源；
- 审核政策和自动校验流程；
- 生成签名市场索引的发布工具；
- GitHub Releases 上的不可变备用分发产物。

本仓库不集中托管社区插件源码，也不定义宿主 API。插件作者在自己的仓库
维护源码；公开 TypeScript 契约由
[`note-gen-plugin-sdk`](https://github.com/codexu/note-gen-plugin-sdk)
维护；插件宿主和安全运行时位于
[`note-gen`](https://github.com/codexu/note-gen)。

第三方插件当前仅面向桌面端。官方内置插件随 NoteGen 发布，不依赖远程市场。

## 静态分发

NoteGen 的无服务器市场设计使用 OSS/CDN 作为主源，并使用 GitHub Release
assets 作为备用源。客户端按顺序访问：

```text
https://download.notegen.top/plugins/v1/index.json
https://download.notegen.top/plugins/v1/index.sig

https://github.com/codexu/note-gen-plugins/releases/latest/download/index.json
https://github.com/codexu/note-gen-plugins/releases/latest/download/index.sig
```

客户端不会读取本仓库的 `main` 分支、Raw 文件或普通目录作为市场源。
因此，向分支提交一个空索引既不能开启市场，也不是有效的发布方式。

## 信任边界

市场使用两层 Ed25519 签名：

1. NoteGen 内置的市场根公钥验证 `index.json` 的原始字节与 `index.sig`；
2. 根索引登记的发布者公钥验证包内 `signature.sig`；该签名覆盖规范化的
   `plugin.json` 与 `integrity.json`。

安装时还会校验插件包 SHA-256，并逐文件验证 `integrity.json`。任何一步
失败都会终止安装，不会降级为未验证安装。

当前插件市场客户端实现中的根公钥仍是安全占位内容，远程市场会在发起下载前
关闭并返回信任配置错误；这不影响官方内置插件。

> [!CAUTION]
> 绝对不要向本仓库、Issue、Pull Request、GitHub Actions 日志或 Release
> 上传市场根私钥、发布者私钥、助记材料或其他签名凭据。

## 为什么暂不开放投稿

正式开放前仍需完成：

- 离线生成并保管市场根密钥，将正式公钥编译进 NoteGen；
- 发布稳定的插件登记格式和发布者密钥登记流程；
- 提供官方打包、签名和验证工具；
- 建立可重复构建、权限差异、恶意内容和许可证审核；
- 建立 CI、人工审核、版本保留和安全响应流程；
- 生成并持续更新根签名索引，同时发布到 OSS/CDN 与 GitHub Releases。

索引最长只能在未来 14 天内有效，`generation` 必须单调递增，同一
generation 的内容不得重写。当前客户端也尚未支持发布者转移、密钥轮换、
撤回 feed、远程封禁或强制停用，因此不能提前承诺完整的安全事故响应能力。

插件作者现在仍可开发插件、通过 NoteGen 桌面端进行本地导入测试，并在自己的
仓库公开源码。投稿开放后，本仓库与官方文档将公布届时受支持的目录结构、
命令、Pull Request 流程和审核规则。

更多信息请访问 [NoteGen 文档](https://notegen.top)。
