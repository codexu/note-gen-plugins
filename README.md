# NoteGen Plugins

[English](README.en.md)

NoteGen 官方插件源码与静态插件市场发布工具的维护仓库。

> [!IMPORTANT]
> 官方插件签名包及生产市场索引已通过 GitHub Actions 发布到 OSS/CDN
> 和 [GitHub Releases](https://github.com/codexu/note-gen-plugins/releases)。
> 客户端需要支持插件市场并内置对应根公钥；社区投稿尚未开放。

## 官方插件

| 插件 | ID | 说明 |
| --- | --- | --- |
| [Bookmarks](plugins/bookmarks) | `top.notegen.bookmarks` | 常用笔记收藏、正文摘要和拖拽排序 |
| [Daily Notes](plugins/daily-notes) | `top.notegen.daily-notes` | 按当前逻辑日期打开或创建每日笔记 |
| [Editor Statistics](plugins/editor-statistics) | `top.notegen.editor-statistics` | 在状态栏显示本地 Markdown 写作统计 |

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

### 界面展示约定

所有官方插件的界面入口由 NoteGen 宿主统一提供独立展示开关，按设备保存，默认展示。
入口来自 `plugin.json` 的 `contributes.views`、`contributes.menus` 和 `contributes.statusBar`；
文件菜单在标签页菜单中的兼容入口也由标签页开关独立控制。插件无需访问宿主私有设置。

- 新增、删除或调整入口时，同步维护 manifest、中文/英文 README 和随包分发的 USAGE。
- 不再为新入口重复定义插件自有展示设置。编辑统计已有的工作区状态栏设置保留兼容。
- 隐藏入口不等于停用插件；命令处理器、数据读写和命令面板继续可用。
- 宿主对隐藏视图的 `views.open()` 请求不执行导航；插件不得强制恢复展示偏好。
- 更新后的说明需要重新打包发布；已有插件包的展示控制由新版宿主直接提供。

### 插件使用说明

- [每日笔记使用说明](plugins/daily-notes/USAGE.zh-CN.md)
- [编辑器统计使用说明](plugins/editor-statistics/USAGE.zh-CN.md)

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

官方插件已发布。社区登记、PR 校验与独立签名包接收链路已实现；生产开放仍需完成真实客户端验收与仓库保护配置。

登记格式见 [社区插件投稿](community/README.md)。作者在自己的仓库维护源码，通过 PR 提交登记资料；审核合并后由维护者在 main 手动发布，合并不等于上架。

## 静态分发设计

### 市场介绍的多语言元数据

在 `market/registry.json` 的插件条目中维护 `localizations`，每种语言包含完整的
`name` 和 `description`。当前官方插件提供 `en` 和 `zh-CN`；这些内容随市场索引
根签名，不依赖下载或执行插件，也不改变已发布插件包的内容。

```json
"localizations": {
  "en": { "name": "Daily Notes", "description": "Open or create the note for the current logical day." },
  "zh-CN": { "name": "每日笔记", "description": "按当前逻辑日期打开或创建每日笔记。" }
}
```

客户端优先匹配完整语言标签，再匹配基础语言；中文缺少地区翻译时使用 `zh-CN`，
随后回退 `en`，最后使用原 `name`、`description`。搜索匹配各语言名称和介绍。
每个插件最多 20 个语言，名称和介绍分别限制为 120、2000 个 UTF-8 字节。

**上线顺序**：先发布支持该可选字段的客户端，再将 Actions 仓库变量
`PLUGIN_MARKET_LOCALIZATIONS` 设为 `true`，发布新一代市场索引。
生成工具对应选项为 `--localized-metadata true`，默认不加入新翻译。
旧客户端严格拒绝未知字段，因此不能在它们仍需使用当前 v1 源时直接开启；
如果必须同时服务旧客户端，应先另建新版索引端点。新版客户端仍能读取旧索引。
已发布的翻译会在后续生成及定时续签时保留，关闭变量不会自动删除它们。
2026-09-10 已开启线上发布开关并发布中英文索引，客户端需支持 `localizations` 字段。

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

市场使用两层 Ed25519 签名：

1. NoteGen 内置的市场根公钥验证 `index.json` 的原始字节与 `index.sig`；
2. 根索引登记的发布者公钥验证包内 `signature.sig`，签名覆盖规范化的
   `plugin.json` 与 `integrity.json`。

安装时还会校验插件包 SHA-256，并逐文件验证 `integrity.json`。任何一步失败
都会终止安装，不会降级为未验证安装。

生产市场已配置根密钥与官方发布者密钥，并向 OSS/CDN 和 GitHub Releases 发布
相同的签名产物。客户端必须内置生产根公钥；仍使用占位内容的本地构建会在下载前
关闭远程市场并返回信任配置错误。发布市场本身不会自动更新已安装的 NoteGen。

## 维护者发布流程

### 每次插件更新

1. 在本仓库 `main` 修改插件，将该插件 `plugin.json` 和 `package.json` 的版本号
   同步提升，并更新 `market/registry.json` 中对应的 `changelog`、使用说明和翻译。
   已发布的同一版本不能包含不同字节；未修改的插件不需要升版本。
2. 提交并推送，确认 CI 通过。在 GitHub Actions 选择
   **Release signed plugin market → Run workflow → main**，填写：

   | 参数 | 填写规则 |
   | --- | --- |
   | `release_tag` | 新的唯一标签，例如 `plugins-v1-20260910-r2`；不要复用已有标签发布新提交 |
   | `generation` | 严格大于线上最高有效索引代际的正整数；不要只依赖时间戳，定时任务可能使用更大的 run ID |
   | `validity_days` | 通常为 `14`，允许范围为 1–14 天 |
   | `first_release` | 正常更新为 `false`；仅确认从未发布过市场时才设为 `true` |

3. Actions 检出固定 SDK 提交，构建、校验、测试和打包插件，使用发布者密钥签署
   插件包，再生成并根签名市场索引。随后发布 GitHub Release，通过阿里云官方
   SDK 上传 OSS，最后更新 CDN 对应的索引指针。
4. 确认 Actions 成功、线上索引包含新版本，验证索引签名及 CDN/GitHub 下载包的
   SHA-256、发布者签名和文件完整性，再到 NoteGen 测试安装和更新。

手动发布会构建和打包**全部官方插件**，GitHub Release 附带本次产物。
已有版本保留原下载路径；OSS 对象已存在且 SHA-256 元数据一致时跳过上传，
缺失时上传，不会覆盖不同内容的同版本文件。

普通插件更新无需发布 npm。只有 SDK 本身发生变化时，才先按
[SDK 发布流程](https://github.com/codexu/note-gen-plugin-sdk#maintainer-release-procedure)
发布相关 npm 包；需要采用该 SDK 的官方插件再更新固定的 `PLUGIN_SDK_REF`。
SDK 发布、插件市场发布和 NoteGen 应用发布是独立流程。

### 自动续签与失败恢复

每周一、周四的定时任务只续签索引，复用已有插件包，不重新构建或打包插件。
14 天是市场索引的签名有效期，不是插件使用期限，也不应当作检查新版本的间隔。

网络或上传中断时，从原 Actions 运行选择 **Re-run jobs**，保留原提交与标签。
如果必须修改代码，使用新提交、新标签和更高的 `generation` 重新发布。
不要删除旧 Release、覆盖同版本包或通过 `first_release` 绕过历史索引校验。

### 发布配置与完整性约束

仓库已经提供两条自动化流程：`CI` 会从固定 SHA 的 SDK 仓库构建 API、CLI 与测试宿主，
然后验证官方插件并执行现有行为测试；`Release signed plugin market` 会打包、
发布者签名、生成根签名索引，并发布不可变的 GitHub Release。每周一和周四的
定时任务只续签索引并复用原有不可变插件包，以 14 天有效期留出 Actions 延迟
和单次失败的恢复余量。

首次发布前，创建 `plugin-market-production` Environment，按团队要求设置审批；
另建不要求人工审批、仅供定时续签的 `plugin-market-refresh` Environment。生产环境
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
秒值，但必须与实际最高代际比较。工作流分别下载 OSS、GitHub latest 和本次 tag 的索引与签名，逐一验签、
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

## 客户端安装与更新检查

| 安装来源 | 使用方式 | 是否参与市场更新 |
| --- | --- | --- |
| 开发版本 | 构建生成 `.notegen/package`，在开发者入口导入；修改后重新构建并重新导入 | 否 |
| 插件市场 | 从「发现」安装，经过索引、包签名和完整性验证 | 是，显示兼容且更高的版本 |

「发现」中的版本是市场版本；“已安装”按钮只表示同 ID 已存在，不表示本地已安装
该版本。请在「已安装」检查实际版本及“开发版本／插件市场”来源标签。

测试 `0.1.0 → 0.1.1` 时，必须先通过市场安装签名的 `0.1.0`，再发布 `0.1.1`。
如果旧版是开发导入，应先卸载开发版，再安装市场版；直接安装市场最新版只能
验证安装，不能验证这次升级。不要为测试升级回滚生产市场索引。

当前客户端进入插件设置时可能复用尚未过期的索引，「更新」页也不会主动联网刷新。
看不到新版本时，先在「发现」点击「刷新」，再回到「更新」。若仍没有更新，检查
已安装来源、实际版本，以及新版本的 `minAppVersion`、`apiVersion` 和平台兼容性。
开发版本不会因为刷新市场而自动转换为市场版本。

## 撤销版本与发布者换钥

整插件下架、恢复发布和历史资产保留的拟议流程见
[插件下架与版本撤销方案](docs/plugin-withdrawal-design.md)（设计草案，尚未实现）。
下面描述的是当前已支持的版本撤销配置。

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

## 2026-09-10 官方插件重发 / Catalog reset

官方插件仅保留 Bookmarks、每日笔记、写作统计，版本统一为 0.1.0。SDK API 版本保持 0.1.1。

本次使用显式 `reset_catalog=true`，保留更高索引 generation，但不保留旧插件和历史版本。新包和索引发布并校验后，清理 OSS `plugins/v1/` 下未被新索引引用的旧资产。日常发布保持该开关关闭。已安装更高版本或开发版本的用户需卸载旧插件后安装新的 0.1.0，不会自动降级。

## 社区插件投稿入口

已提供社区登记和独立签名包发布链路，见 [社区插件投稿](community/README.md)。作者通过 PR 修改 `community/registry.json`，审核合并后由维护者在 main 手动发布。生产开放仍需配置分支/环境保护并完成真实客户端验收；合并不等于上架。
