# 插件下载量统计配置

工作流：`.github/workflows/plugin-download-stats.yml`。
脚本：`tools/collect-plugin-downloads.py`。

每天 UTC 04:37（北京时间 12:37）读取阿里云 CDN 离线日志，默认回查最近
7 天及当天已结束的小时。GitHub Actions 定时执行可能延迟。
当前只实现统计与发布数据，NoteGen 客户端尚未接入展示。

工作流固定使用 Python 3.11，兼容当前阿里云 SDK 内置的旧版 TLS 实现，
避免随 runner 默认 Python 升级出现 SNI 检测异常。日志输出不使用缓冲，
每处理完一份日志即可在 Actions 中查看计数。

## 统计口径

- 只统计配置域名 `/plugins/v1/packages/` 下、文件名对应已知插件 ID 和
  SemVer 版本的 `.notegen-plugin` 包，要求请求方法为 GET、响应码为 200。
- 排除 HEAD、失败请求、206 分段响应、索引和签名文件；更新、重新安装、
  手工下载和机器人请求可能被计入。HTTP 200 不能证明包已完整下载或安装成功。
- 不包含 GitHub 备用源和社区插件自有仓库的下载。
- 通过 OSS 当前市场索引识别插件 ID，历史 ID 持久保留；同一版本的不同
  发布路径合并到同一插件版本，插件总量跨版本累计。遇到未知包名或不支持的
  日志格式会失败，不会保存本轮增量。
- 不保存访客 IP、User-Agent、原始日志和带签名的下载链接。

输出位于独立命名空间，现有市场 `reset_catalog` 清理不会删除它们：

| OSS Object Key | 用途 |
| --- | --- |
| `plugins/stats/v1/state.json` | 累计计数、已知插件 ID、已处理日志标识与时间窗口 |
| `plugins/stats/v1/stats.json` | 提供给客户端的公开统计 |

公开地址：`https://download.notegen.top/plugins/stats/v1/stats.json`。
统计数据不进入签名市场索引，也不参与插件安装验证。

`stats.json` 格式示例（仅示例，不表示真实下载量）：

```json
{
  "schemaVersion": 1,
  "source": "aliyun-cdn-offline-logs",
  "domain": "download.notegen.top",
  "metric": "http-200-get-requests",
  "updatedAt": "2026-10-27T04:37:00Z",
  "windowStart": "2026-10-01T00:00:00Z",
  "windowEnd": "2026-10-27T04:00:00Z",
  "totalDownloads": 12,
  "plugins": {
    "top.notegen.bookmarks": {
      "downloads": 12,
      "versions": { "0.1.2": 12 }
    }
  }
}
```

`windowStart`、`windowEnd` 表示查询过的时间范围，不保证每个小时的日志均已
生成或覆盖完整。`updatedAt` 是聚合时间，不是最后一次下载时间。

## 阿里云配置

1. 确认 `download.notegen.top` 使用的是阿里云 **CDN**，并能在 CDN 控制台的
   离线日志中下载到该域名的日志。本脚本不适用于 ESA/DCDN 的其它 API。
   使用默认离线日志格式；不需要开通实时日志或 SLS。
2. 确认 OSS Bucket、地域和 Endpoint 与现有发布配置一致。
3. 创建统计专用 RAM 用户及 AccessKey，绑定下面的最小权限策略。
   替换 `<ACCOUNT_ID>`、`<BUCKET_NAME>`；域名改变时同步修改策略和 GitHub 变量。
4. 确认 CDN 可以从 OSS 回源读取 `plugins/stats/v1/stats.json`。
   保持 Bucket 原有访问控制，不需要把整个 Bucket 改为公开。
   为这个统计地址设置 5 分钟缓存；脚本也会写入 `Cache-Control: public,max-age=300`。
   如果已有强制缓存规则覆盖响应头，请单独调整该路径规则。

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cdn:DescribeCdnDomainLogs"],
      "Resource": ["acs:cdn:*:<ACCOUNT_ID>:domain/download.notegen.top"]
    },
    {
      "Effect": "Allow",
      "Action": ["oss:GetObject"],
      "Resource": [
        "acs:oss:*:*:<BUCKET_NAME>/plugins/v1/index.json",
        "acs:oss:*:*:<BUCKET_NAME>/plugins/stats/v1/state.json"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject"],
      "Resource": [
        "acs:oss:*:*:<BUCKET_NAME>/plugins/stats/v1/state.json",
        "acs:oss:*:*:<BUCKET_NAME>/plugins/stats/v1/stats.json"
      ]
    }
  ]
}
```

不需要 OSS 列举/删除权限、CDN 刷新权限或任何市场签名密钥。
统计用户需要通过公网访问 OSS，Endpoint 使用地域公网地址。
请为 `state.json` 保留备份或开启 OSS 版本控制；不要设置自动删除该对象的生命周期规则。
本脚本不设置单对象 ACL；如果 Bucket 本身公开，状态文件也可能被公开读取，
其中只有计数、插件 ID 和日志元数据的 SHA-256 标识，没有访客数据。

## GitHub 配置

在仓库 Settings → Environments 新建 **`plugin-market-statistics`**。
该环境允许 `main`，自动统计场景下不要设置需要人工确认的审批规则。
它与 `plugin-market-production`、`plugin-market-refresh` 相互独立，
环境级 Secrets/Variables 不会从其它 Environment 自动继承。

Environment Secrets：

| 名称 | 值 |
| --- | --- |
| `OSS_ACCESS_KEY_ID` | 上述统计专用 RAM 用户的 AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | 对应的 AccessKey Secret |

Environment Variables：

| 名称 | 值 |
| --- | --- |
| `OSS_ENDPOINT` | 与现有发布配置一致的 OSS 公网 Endpoint |
| `OSS_REGION` | Bucket 地域，例如 `cn-hangzhou`，以实际值为准 |
| `OSS_BUCKET` | 现有插件包所在 Bucket 名称 |
| `OSS_PUBLIC_BASE_URL` | `https://download.notegen.top/plugins/v1` |
| `CDN_DOMAIN` | `download.notegen.top`，不带协议、路径或末尾斜杠 |

确认仓库启用 GitHub Actions，且工作流文件已提交到默认分支 `main`。
仓库级 Actions token 只需要读取代码；不需要 SDK、市场私钥或 GitHub 写权限。
GitHub 可能因公共仓库长期无活动而停用定时工作流，恢复后应手动补跑。

## 首次运行与人工验收

以下步骤由维护者在首次配置后执行。

1. Actions → **Collect plugin download statistics** → Run workflow，选择 `main`，
   设置 `lookback_days=29`，保留 `dry_run=true`。确认读取日志成功，输出各日志行数和增量。
   只读预览不会保存状态，下次正式运行仍会重新读取同一批日志。
2. 同样设置 `lookback_days=29`，取消 `dry_run`，正式写入 OSS。
3. 打开公开统计地址，查看 `updatedAt`、`totalDownloads`、各插件与版本计数。
4. 再次运行相同范围，确认已有日志不会重复累计。日志延迟到达时计数可以增加。
5. 确认后续定时运行成功，日常默认回查 7 天。

## 去重、恢复与局限

用域名、日志名称和起止时间生成稳定标识，忽略可能变化的签名 URL。
每轮先完整处理日志，再用一次对象写入将累计计数和检查点一起保存到 `state.json`，
随后发布 `stats.json`。任意日志读取或解析失败都不会提交本轮状态；公开文件
发布失败时，下轮会根据已提交状态重新生成，不会重复累计。
工作流通过同一并发组串行执行，以保证只有一个写入者。
不要在工作流之外同时运行另一个写入任务，否则可能覆盖彼此的累计状态。

日志检查点保留 35 天，累计计数长期保留。手动回查范围为 1–29 天。
停跑后会尝试从上次查询结束时间补齐，最多回查 29 天；超出范围会告警，
无法恢复已过期日志。每日回查不能保证补齐超过回查范围才到达的迟到日志，
必要时手动设置 29 天补跑。首轮只能统计仍可获取的历史，不能恢复全部历史下载量。
无新日志时任务会告警，仍会重新发布当前累计值；应检查域名流量和日志延迟。

不要删除 `state.json` 后直接重跑：这会重置累积历史。应从备份恢复状态。
该统计没有独立的防刷或访客去重机制，CDN 重发/重组已处理日志也不自动修订；
更正历史需要使用经核对的状态备份。大量历史日志若超过 60 分钟任务上限，
需先调整工作流资源/超时再回填；失败的整轮不会保存部分进度。

参考：[CDN 离线日志格式与延迟](https://help.aliyun.com/en/cdn/user-guide/offline-logs-quick-start)、
[DescribeCdnDomainLogs API 与 RAM 授权](https://www.alibabacloud.com/help/en/cdn/developer-reference/api-cdn-2018-05-10-describecdndomainlogs)。
