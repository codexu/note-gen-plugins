# Plugin download statistics setup

Workflow: `.github/workflows/plugin-download-stats.yml`.
Script: `tools/collect-plugin-downloads.py`.

Runs daily at 04:37 UTC (12:37 Asia/Shanghai), rechecking seven previous days
and completed hours of the current day. GitHub may delay scheduled execution.
This implements collection and publication only; NoteGen does not yet display these metrics.

## Counting rules

- Count GET requests returning HTTP 200 for known plugin IDs and SemVer package
  filenames under the configured domain's `/plugins/v1/packages/` path.
- Exclude HEAD, errors, HTTP 206 ranges, indexes and signatures. Updates,
  reinstalls, manual downloads and bots may count. HTTP 200 does not prove a
  complete download or successful installation.
- Exclude GitHub fallback downloads and community packages hosted elsewhere.
- Discover IDs from the live OSS market index and retain historical IDs.
  Combine different release paths for the same ID/version and accumulate totals
  across versions. Unknown package names or unsupported log formats fail the run
  without committing its increments.
- Do not retain visitor IPs, user agents, raw logs or signed download URLs.

Outputs live outside `plugins/v1/`, so market `reset_catalog` cleanup preserves them:

| OSS object key | Purpose |
| --- | --- |
| `plugins/stats/v1/state.json` | Counters, known plugin IDs, processed log identities and query window |
| `plugins/stats/v1/stats.json` | Public client metrics |

Public URL: `https://download.notegen.top/plugins/stats/v1/stats.json`.
Metrics do not change the signed market index or installation verification.

Example output (illustrative counts):

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

`windowStart` and `windowEnd` describe queried ranges, not guaranteed complete
hourly coverage. `updatedAt` is aggregation time, not the last download time.

## Alibaba Cloud

1. Confirm `download.notegen.top` uses Alibaba Cloud **CDN** and its offline logs
   are downloadable in the CDN console. Other ESA/DCDN APIs are not supported.
   Keep the default offline log format. Real-time logs and SLS are not required.
2. Use the existing publisher's OSS bucket, region and public endpoint.
3. Create a dedicated RAM user and AccessKey with the policy below. Replace
   `<ACCOUNT_ID>` and `<BUCKET_NAME>`. Update both policy and GitHub variables
   if the domain changes.
4. Ensure CDN origin access permits `plugins/stats/v1/stats.json`. Preserve the
   bucket's existing access controls; a publicly readable bucket is not required.
   Set a five-minute cache rule for this URL. The script also sends
   `Cache-Control: public,max-age=300`; adjust rules that override this header.

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

No OSS listing/deletion, CDN invalidation or signing-key permissions are needed.
The runner needs the public regional OSS endpoint. Back up `state.json` or enable
OSS versioning, and exclude it from automatic lifecycle deletion.
The script does not set object ACLs. In a public bucket, state may be readable;
it contains counters, plugin IDs and SHA-256 log metadata identities, not visitor data.

## GitHub

Create **`plugin-market-statistics`** in repository Settings → Environments.
Allow `main`; do not require manual environment approval for unattended runs.
Secrets and variables from `plugin-market-production` or `plugin-market-refresh`
are not automatically inherited.

Environment Secrets:

| Name | Value |
| --- | --- |
| `OSS_ACCESS_KEY_ID` | Dedicated statistics RAM AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | Corresponding AccessKey Secret |

Environment Variables:

| Name | Value |
| --- | --- |
| `OSS_ENDPOINT` | Existing publisher's public regional OSS endpoint |
| `OSS_REGION` | Actual bucket region, for example `cn-hangzhou` |
| `OSS_BUCKET` | Existing plugin bucket name |
| `OSS_PUBLIC_BASE_URL` | `https://download.notegen.top/plugins/v1` |
| `CDN_DOMAIN` | `download.notegen.top`, without scheme, path or trailing slash |

Enable GitHub Actions and commit the workflow to the default branch `main`.
The Actions token needs only repository read access; no SDK, signing keys or
GitHub write permission is required. GitHub may disable schedules in inactive
public repositories; manually backfill after reenabling.

## First run and manual acceptance

These steps are for the maintainer after configuration. No cloud task or check
was executed as part of this implementation.

1. Actions → **Collect plugin download statistics** → Run workflow on `main`.
   Set `lookback_days=29` and leave `dry_run=true`. Check parsed line counts and
   increments. A dry run never checkpoints, so publication rereads the same logs.
2. Run again with `lookback_days=29` and `dry_run` disabled to publish.
3. Open the public URL and inspect timestamps, totals and per-version counters.
4. Repeat the same range: processed logs must not increase totals again. Newly
   delivered logs may increase counts.
5. Confirm daily scheduled runs succeed with the default seven-day lookback.

## Deduplication and recovery

Stable log identities hash the domain, log name and time boundaries, excluding
expiring download URLs. After all logs are parsed, counters and checkpoints are
committed together in one OSS object write, then public metrics are updated.
A log failure commits nothing. If public publication fails, the next run rebuilds
it from committed state without recounting. The workflow concurrency group
serializes runs to guarantee a single writer. Do not run a second writer outside
this workflow: concurrent writers could overwrite each other's cumulative state.

Checkpoints are retained for 35 days; aggregate counters persist indefinitely.
Manual lookback accepts 1–29 days. Missed runs trigger catch-up from the previous
query end, capped at 29 days with a warning for older gaps. Very late logs outside
the normal lookback require a manual 29-day backfill. The first run cannot recover
expired history. Runs without new logs warn and still republish current totals;
check traffic and delivery delays.

Do not delete state and rerun: that resets historical totals. Restore a backup
instead. There is no bot filtering, visitor deduplication or automatic correction
for CDN reissuing/reorganizing previously processed logs. Historical corrections
require reviewed state backups. If a large backfill exceeds the 60-minute job
limit, adjust workflow resources/timeouts before retrying; failed runs retain no
partial progress.

References: [CDN offline format and delivery](https://www.alibabacloud.com/help/en/cdn/user-guide/offline-logs-quick-start),
[DescribeCdnDomainLogs API and RAM authorization](https://www.alibabacloud.com/help/en/cdn/developer-reference/api-cdn-2018-05-10-describecdndomainlogs).
