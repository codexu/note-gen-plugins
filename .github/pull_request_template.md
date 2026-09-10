## 社区插件投稿 / Community plugin submission

- 插件 ID / Plugin ID:
- 首次上架、版本更新、换钥或撤销 / New, update, key rotation, or revocation:
- 源码仓库与固定提交 / Source repository and commit:
- 使用说明与截图 / Usage guide and screenshots:
- 权限用途、联网行为 / Permissions and network behavior:
- 验证过的 NoteGen 版本与操作系统 / Tested app versions and systems:

### 作者确认 / Author checklist

- [ ] 仅修改 `community/registry.json`，新增版本放在 releases 开头，旧版本不变。
- [ ] 公开源码、许可证、锁文件、构建说明和离线 USAGE；制品与该源码对应。
- [ ] 插件包使用自己的发布者密钥签名，未上传私钥或个人笔记。
- [ ] 已在真实 NoteGen 桌面端验证功能、授权与失败处理。

### 维护者审核 / Maintainer review

作者不要代勾。首次身份/公钥和换钥需独立确认；自动验签不代表可信。

- [ ] 核实作者身份、仓库所有权、公钥与完整源码提交。
- [ ] 审查锁文件和构建过程，在隔离环境重建并核对产物。
- [ ] 检查权限最小范围、数据上传、许可证和使用说明。
- [ ] 验证实际安装、授权、主要操作和升级；记录客户端版本与结果。
- [ ] 确认 CI 通过，并在审核评论中记录源码 SHA、包 SHA-256、keyId 和审核结果。

合并仅完成登记。维护者需在 main 手动运行市场发布工作流；不要在 PR 中运行生产签名。
