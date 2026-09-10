# 社区插件投稿

社区插件在作者自己的仓库维护，通过 PR 向本仓库登记。合并后，由 NoteGen 维护者运行市场发布工作流，上架到客户端「发现」。作者不需要提供服务器，也不提交插件源码或私钥到本仓库。

当前为投稿流程实现阶段：生产启用仍需维护者设置分支保护、审核发布环境，并完成独立发布者的真实客户端验收。不要把登记 PR 合并视为已经上架。

## 作者步骤

1. 使用支持目标 NoteGen 版本的 SDK 开发插件，提交源码、lockfile、许可证、README 和离线 `USAGE.md`。在桌面应用中完成开发导入验证。
2. 固定源码提交，记录完整 40 位 SHA。按仓库说明构建和打包，用自己的 Ed25519 发布者密钥签名；同一 ID 与版本的包不得替换。
3. 将最终 `.notegen-plugin` 上传到自己仓库的版本化 GitHub Release。计算整个签名包的 SHA-256，保留该 Release。
4. 修改 `community/registry.json`：首次登记 publisher，新增 plugin；更新时只在 releases 开头追加新版本。插件信息和所有历史 release 保留。
5. 按 PR 模板填写使用说明、截图、权限用途、已验证环境。等待自动校验和维护者审核；不要修改发布工作流或市场索引。
6. 维护者发布后，到 NoteGen「发现」刷新安装。开发导入版本不参与市场更新，测试市场更新需先安装市场旧版。

签名命令见 [官网打包与验证](https://notegen.top/cn/docs/plugins/developers/package-verify)。生成密钥后长期保管私钥；投稿只提供公钥。

## 登记格式

`registry.json` 的根字段为 schemaVersion（1）、publishers 和 plugins，未知字段会被拒绝。以下是格式示例，尖括号内容必须替换；它不是可直接提交的数据：

```json
{
  "schemaVersion": 1,
  "publishers": [{
    "id": "example-author",
    "name": "Example Author",
    "repository": "https://github.com/example/my-plugin",
    "keyId": "ed25519-<公钥原始字节的SHA256>",
    "publicKey": "<32字节Ed25519公钥的Base64>"
  }],
  "plugins": [{
    "id": "com.example.my-plugin",
    "publisherId": "example-author",
    "repository": "https://github.com/example/my-plugin",
    "categories": ["productivity"],
    "releases": [{
      "version": "0.1.0",
      "sourceCommit": "<完整40位源码提交SHA>",
      "packageUrl": "https://github.com/example/my-plugin/releases/download/v0.1.0/com.example.my-plugin-0.1.0.notegen-plugin",
      "packageSha256": "<签名包的64位SHA256>",
      "publisherKeyId": "ed25519-<公钥原始字节的SHA256>",
      "changelog": "首次发布。",
      "buildInstructions": "使用锁文件安装依赖，再运行项目的构建和打包命令；注明Node、pnpm和SDK版本。",
      "permissionsReason": "逐项说明权限用途和范围；没有权限时明确写无需权限。",
      "testedOn": "填写实际验证过的NoteGen版本、操作系统与主要操作。"
    }]
  }]
}
```

- publisher.id 为 3–80 位小写字母、数字、连字符，首位字母；`notegen` 保留。publisher.repository 用于身份审核，登记后不可更改。
- plugin.id 使用 SDK 支持的 ID，`top.notegen.*` 保留；同一插件不得更换发布者或源码仓库。仓库 URL 为无 `.git` 后缀的 HTTPS GitHub 地址，必须与包内 manifest 一致。
- 每个 release 引用固定 tag 下的 GitHub Release 资产，不能用 latest 地址、查询参数或其他仓库。下载和验签不会执行作者代码。单包下载最多 20 MiB，SDK 还会校验压缩包、完整性和 manifest。
- sourceCommit、构建说明、权限说明和 testedOn 是人工审核资料；自动验签不证明可重复构建或实际运行成功。
- name、description、license、兼容版本和权限从通过验签的 manifest 生成，不由作者另填市场字段。当前仅接受 desktop，且必须声明许可证。
- 发布者最多 99 个（另留一个官方名额），每个插件最多 100 个版本；不要删除历史记录来绕过限制。
- `official`、`featured`、`verified` 不接受作者输入。社区插件发布为 `official: false`、`featured: false`，发布者不自动获得 verified 标记。

## 自动检查

仓库 CI 先构建固定版本 SDK，再运行 `tools/community.py`。它检查登记字段、重复身份、公钥、历史不可变约束，并对新提交版本下载、核对 SHA-256、调用 SDK 验签、核对 manifest。PR 不运行作者的构建脚本，也不使用生产签名或 OSS 凭据。

CI 对基准提交中已有的 release 不重复下载，避免作者移除旧资产后阻塞撤销。正式发布时使用经过根签名验证的线上历史记录；所有尚未上架的版本仍会重新下载并验签。

本地完整校验（先按仓库 README 准备并构建 `.sdk`）：

```bash
python3 tools/community.py --artifacts /tmp/notegen-community-packages --output /tmp/notegen-community-catalog.json
```

输出路径应为本次运行新建的目录和文件，已存在的产物不会覆盖。输出只供市场流水线使用，作者不提交这些文件。校验不执行源码，也不等于安全审核。

## 更新、换钥与撤销

更新：提升版本，发布新的签名包，在 releases 开头追加完整登记记录。同一版本的资料、包摘要、签名身份和源码 SHA 均不可修改。

换钥：提交 PR 修改 publisher 的当前 keyId/publicKey，将旧的 `{ keyId, publicKey }` 追加到 `previousKeys`；保留所有旧钥，最多 16 个。新 release 引用新 keyId，旧 release 保持原 keyId。维护者需独立确认身份，不能仅凭 PR 声明批准换钥。

撤销：在 plugin 增加 `revocations: { "0.1.0": "具体撤销原因" }`，只能引用已登记版本，原因最多 500 字符。旧撤销不能删除或改写。发布新的索引后客户端才会收到；离线客户端不会即时停止。正常停止维护不要用撤销替代下架说明。

跨作者或仓库转移：第一版不支持，使用新的插件 ID 并让用户重新安装授权。需要更改已冻结的错误记录时，先由维护者设计单独迁移，不能绕过校验。

## 维护者启用与发布

1. 将 main 设置为受保护分支，要求 PR、CI 成功和 CODEOWNERS 审核。`.github/CODEOWNERS` 只声明审核人，本身不启用分支保护。
2. 设置 `plugin-market-production` 环境的审核人和 main 部署限制，保留现有密钥及 OSS 配置。PR 不能访问该环境。首次生产启用需核对 `PLUGIN_SDK_REF` 为支持所需 API 的完整已审核提交。
3. 按 PR 模板审核身份、公钥、源代码、权限与许可证。在隔离环境重建，并核对包内有效载荷；不要把作者代码放到生产签名环境执行。将源码 SHA、包摘要、keyId、客户端版本及验收结果写入审核评论。
4. 合并后，在 main 手动运行 **Release signed plugin market**，使用新 release_tag、更高 generation，通常保持 first_release 和 reset_catalog 为 false。
5. 流水线在加载生产密钥前重新验签社区包。社区包保留作者签名，与官方包一起复制到 OSS/CDN 和 GitHub Releases；根密钥只签市场索引。
6. 首次开放前，以独立发布者完成首次安装、版本升级、权限变化、撤销和换钥验收，再公告开放。CI 与代码实现不能替代这一步。

每周定时续签只更新现有索引有效期，不会自动发布刚合并的社区登记。发布中断继续使用现有不可变 Release 恢复流程。存在已发布社区插件时禁止 reset_catalog 清空历史；撤销无需重新下载已经根签名确认的旧包。
