# NoteGen Plugins

[English](README.en.md)

NoteGen 官方插件源码与静态插件市场发布工具的维护仓库。

> [!IMPORTANT]
> 本仓库现在提供官方插件源码与完整的签名发布流程，但尚未发布 NoteGen 可消费的
> 生产市场索引、索引签名和签名插件包。远程市场与社区投稿也尚未开放。

## 官方插件

| 插件 | ID | 说明 |
| --- | --- | --- |
| [Daily Notes](plugins/daily-notes) | `top.notegen.daily-notes` | 按当前逻辑日期打开或创建每日笔记 |
| [Editor Statistics](plugins/editor-statistics) | `top.notegen.editor-statistics` | 在状态栏显示本地 Markdown 写作统计 |
| [Plugin Playground](plugins/plugin-playground) | `top.notegen.plugin-playground` | 覆盖公开插件 API 的交互测试与官方开发示例 |

这些插件都是独立插件，只使用
[`@notegen/plugin-api`](https://github.com/codexu/note-gen-plugin-sdk/tree/main/packages/plugin-api)
提供的公开宿主契约。它们不依赖 NoteGen 应用内部模块，也不会以内置插件形式
随应用加载。

## 源码边界

本仓库集中维护 **NoteGen 官方插件** 的源码。社区插件的源码仍由各自作者在
各自仓库维护；未来本仓库只登记经过审核的发布者、版本和分发信息，不会把
社区插件源码复制到这里。

- 公开插件 API、CLI 和测试工具：
  [`note-gen-plugin-sdk`](https://github.com/codexu/note-gen-plugin-sdk)
- 插件宿主与安全运行时：
  [`note-gen`](https://github.com/codexu/note-gen)
- 官方插件源码与市场登记、签名发布工具：本仓库

## 本地开发

### 插件使用说明

- [每日笔记使用说明](plugins/daily-notes/USAGE.zh-CN.md)
- [编辑器统计使用说明](plugins/editor-statistics/USAGE.zh-CN.md)
- [插件能力实验室使用说明](plugins/plugin-playground/USAGE.zh-CN.md)

使用说明随插件包离线分发。插件目录中的 `USAGE.md` 为英文默认说明，
`USAGE.zh-CN.md` 为中文说明；更新后的 SDK 构建工具会自动打包并校验它们。
修改说明后需要重新构建、导入插件，NoteGen 才能读取新内容。

### 构建插件

需要 Node.js 20 或更高版本、pnpm 10，以及一份经过审核的 SDK 提交。SDK 固定
放在被忽略的 `.sdk` 目录，提交 SHA 必须与仓库变量 `PLUGIN_SDK_REF` 一致：

```bash
git clone https://github.com/codexu/note-gen-plugin-sdk.git .sdk
git -C .sdk checkout <PLUGIN_SDK_REF 的完整 40 位提交 SHA>
pnpm install --frozen-lockfile
pnpm build
pnpm validate
pnpm test
pnpm run plugin:pack
```

也可以只操作一个插件：

```bash
pnpm --filter @notegen/plugin-daily-notes build
pnpm --filter @notegen/plugin-editor-statistics validate
```

每个插件的 `package.json` 版本必须与 `plugin.json#version` 保持一致。构建由
`@notegen/plugin-cli` 完成，开发包输出到插件目录下的 `.notegen/package`。

仓库提交的 `pnpm-lock.yaml` 同时锁定官方插件及 `.sdk/packages/*` 的完整依赖；
CI 使用 `--frozen-lockfile`，所以 SDK 提交改变依赖后必须在同一个审查中更新
`PLUGIN_SDK_REF` 和 lockfile。`.sdk` 本身不会提交。社区开发者仍通过 npm 使用
SDK；这种源码检出只用于官方插件的可复现发布链。

## 市场状态

市场正式开放后，本仓库计划承载：

- 社区插件与发布者的登记来源；
- 审核政策和自动校验流程；
- 生成签名市场索引的发布工具；
- GitHub Releases 上的不可变备用分发产物。

目前不存在“提交 Pull Request 即上架”的流程，也不要按自定义目录或 JSON
格式提交社区插件。官方插件源码进入本仓库不代表已发布到市场。

## 静态分发设计

NoteGen 的无服务器市场使用 OSS/CDN 作为主源，并使用 GitHub Release assets
作为备用源。客户端按顺序访问：

```text
https://download.notegen.top/plugins/v1/index.json
https://download.notegen.top/plugins/v1/index.sig

https://github.com/codexu/note-gen-plugins/releases/latest/download/index.json
https://github.com/codexu/note-gen-plugins/releases/latest/download/index.sig
```

客户端不会读取本仓库的 `main` 分支、Raw 文件或普通目录作为市场源。因此，
提交官方插件源码或一个未签名索引都不能开启市场。

## 信任边界

市场将使用两层 Ed25519 签名：

1. NoteGen 内置的市场根公钥验证 `index.json` 的原始字节与 `index.sig`；
2. 根索引登记的发布者公钥验证包内 `signature.sig`，签名覆盖规范化的
   `plugin.json` 与 `integrity.json`。

安装时还会校验插件包 SHA-256，并逐文件验证 `integrity.json`。任何一步失败
都会终止安装，不会降级为未验证安装。

当前插件市场客户端的根公钥仍是安全占位内容，远程市场会在下载前关闭并返回
信任配置错误。正式开放前还需要离线生成市场根密钥并受控保管、建立发布者密钥
登记与审核流程，并把相同的签名产物发布到 OSS/CDN 和 GitHub Releases。

## 维护者发布流程

仓库已经提供两条自动化流程：`CI` 会从固定 SHA 的 SDK 仓库构建 API、CLI 与测试宿主，
然后验证官方插件并执行现有行为测试；`Release signed plugin market` 会打包、
发布者签名、生成根签名索引，并发布不可变的 GitHub Release。每周一和周四的
定时任务只续签索引并复用原有不可变插件包，以 14 天有效期留出 Actions 延迟
和单次失败的恢复余量。

首次发布前，创建需要人工审批的 `plugin-market-production` Environment，以及
不要求人工审批、仅供定时续签的 `plugin-market-refresh` Environment。生产环境
配置完整凭据，续签环境只配置续签所需的根密钥、公开信息和 OSS 凭据：

- Secrets：`PUBLISHER_PRIVATE_KEY_B64`、`MARKET_ROOT_PRIVATE_KEY_B64`；
- Variables：`PUBLISHER_PUBLIC_KEY_JSON`、`MARKET_ROOT_PUBLIC_KEY`；
- OSS Secrets：`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`；
- OSS Variables：`OSS_ENDPOINT`、`OSS_REGION`、`OSS_BUCKET`、`OSS_PUBLIC_BASE_URL`；
- 仓库变量：固定 40 位提交 SHA 的 `PLUGIN_SDK_REF`。

两个私钥值都是 PEM 文件的 Base64 编码；`PUBLISHER_PUBLIC_KEY_JSON` 使用
`market/publisher.example.json` 所示结构。根公钥还必须作为 NoteGen 仓库的
`PLUGIN_MARKET_ROOT_PUBLIC_KEY` Actions Variable 配置，正式应用构建会校验它
确实是规范的 32 字节 Ed25519 公钥后再嵌入安装包。

手动发布时，`generation` 必须严格大于当前线上索引；默认建议使用 UTC Unix
秒值。工作流分别下载 OSS、GitHub latest 和本次 tag 的索引与签名，逐一验签、
校验结构后取最高 generation；同代际出现不同有效字节会失败。OSS 的两个指针
更新中断或暂时不同步时，可以从有效 GitHub 副本恢复。找不到历史索引时，只有
显式勾选 `first_release` 才能首次发布；发现索引但全部验签失败时不能用该选项重置。
OSS 中的插件包和代际索引使用不可变路径与一年
缓存，当前 `index.json`/`index.sig` 使用禁用缓存的指针路径。插件版本同时记录
OSS 主地址和 GitHub Release 镜像地址，所有地址最终都必须通过同一个 SHA-256
校验。重跑相同 tag 时，只接受与现有 GitHub/OSS 对象完全一致的字节；如果该
Release 已被更高代际取代，工作流会拒绝把线上指针回滚到旧代际。

Release tag 固定到本次实际构建的 `GITHUB_SHA`，已存在的 tag 也必须解析到同一
提交。`release-metadata.json` 和 Release 说明记录源码提交及实际检出的 SDK SHA；
定时续签没有重建 SDK，因此 `sdkCommit` 为 `null`。重跑应使用 Actions 的
Re-run jobs，以保留原源码提交；定时任务也会复用同一 run ID 对应的 tag。

每个 release 保存自己的权限摘要，客户端选择兼容旧版本时会使用该版本的权限。
生成和续签会保留已有摘要，并将旧格式缺失的摘要从原插件条目的 `permissions`
回填。每个插件最多包含 100 个 release；新增第 101 个版本会在签名前失败，
维护者必须先审核并发布明确的版本保留调整，工具不会自动删除仍被旧客户端使用的版本。

> [!CAUTION]
> 绝对不要向本仓库、Issue、Pull Request、GitHub Actions 日志或 Release
> 上传市场根私钥、发布者私钥、恢复材料或其他签名凭据。

## 撤销版本与发布者换钥

在 `market/registry.json` 对应插件登记中添加 `revocations`，例如：

```json
"revocations": { "0.1.0": "此版本存在数据处理缺陷，请更新" }
```

发布更高 generation 的签名索引。撤销原因会写入 release 的 `revoked`；客户端
不再安装该版本，正在运行的副本在收到刷新结果后停止，缓存中的撤销在重启和
回滚时同样生效。宿主启动后和每 30 分钟刷新；离线且尚未收到撤销的客户端无法
提前知道撤销。定时续签保留撤销信息。不要删除历史撤销记录来重新启用有问题的版本。

正常换钥时，在 registry 顶层登记 `previousPublisherKeys`：

```json
"previousPublisherKeys": [
  { "keyId": "旧密钥的实际 ID", "publicKey": "旧公钥的实际 Base64" }
]
```

最多保留 16 个旧公钥。使用新发布者凭据发布一个新版本，不能重新签署并覆盖旧
版本。生成器为历史 release 保留 `publisherKeyId`；旧包继续使用其原公钥验证，
新包使用新公钥。市场根签名授权相同发布者 ID 的这次密钥变更，客户端重新审核
新来源的授权。发布者公钥凭据 JSON 仍保持 algorithm/keyId/publicKey 三字段，
历史公钥只放 registry，避免与 SDK 验签工具的严格格式冲突。

密钥泄露时，换钥之外还须撤销受影响版本并发布公告。市场根密钥本身的轮换需要
发布带新信任根的应用版本，不可用发布者换钥字段代替。

## 社区投稿准备

社区仍未开放。开放前按 [社区审核流程](COMMUNITY-REVIEW.md) 完成维护者试运行，
并保留一次真实客户端安装、更新、撤销和换钥验收记录。

## 许可证

本仓库中的官方插件源码按照 [GNU GPL v3 或更高版本](LICENSE)发布。未来登记的
社区插件仍采用各自源码仓库与插件清单声明的许可证。

更多信息请访问 [NoteGen 文档](https://notegen.top)。
