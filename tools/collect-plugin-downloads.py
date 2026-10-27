"""Aggregate Alibaba Cloud CDN offline logs without retaining visitor data."""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import io
import json
import os
import re
import sys
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen

import oss2
from oss2.credentials import EnvironmentVariableCredentialsProvider
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.request import CommonRequest


UTC = timezone.utc
STATE_KEY = 'plugins/stats/v1/state.json'
PUBLIC_KEY = 'plugins/stats/v1/stats.json'
# Alibaba CDN default offline format: timestamp, IPs, duration, referrer,
# quoted "METHOD URL", status, sizes, cache status, user agent, ...
LOG_LINE = re.compile(
    r'^\[[^\]]+\]\s+\S+\s+\S+\s+\S+\s+"[^"\r\n]*"\s+'
    r'"(?P<method>[A-Z]+)\s+(?P<url>\S+)(?:\s+HTTP/[^"\s]+)?"\s+'
    r'(?P<status>\d{3})\s+'
)
VERSION = re.compile(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?')


class CollectionError(Exception):
    """An actionable error message safe to display without visitor data or secrets."""


def timestamp(value):
    return value.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_time(value):
    return datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=UTC)


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def list_logs(client, domain, start, end):
    page = 1
    while True:
        request = CommonRequest()
        request.set_domain('cdn.aliyuncs.com')
        request.set_version('2018-05-10')
        request.set_action_name('DescribeCdnDomainLogs')
        request.set_accept_format('json')
        request.set_protocol_type('https')
        for key, value in {
            'DomainName': domain, 'StartTime': timestamp(start),
            'EndTime': timestamp(end), 'PageSize': '1000', 'PageNumber': str(page),
        }.items():
            request.add_query_param(key, value)
        payload = json.loads(client.do_action_with_exception(request))
        details = payload['DomainLogDetails']['DomainLogDetail']
        if not details:
            return
        if len(details) != 1 or details[0]['DomainName'] != domain:
            raise CollectionError('Unexpected domain in CDN log response')
        detail = details[0]
        logs = detail['LogInfos']['LogInfoDetail']
        yield from logs
        total = int(detail['PageInfos']['Total'])
        if page * 1000 >= total:
            return
        if not logs:
            raise CollectionError('CDN pagination ended before the reported total')
        page += 1


def count_log(log, domain, package_prefix, plugin_ids):
    # LogPath may omit its scheme. Never print its signed query string.
    location = log['LogPath']
    if '://' not in location:
        location = 'https://' + location
    parsed = urlsplit(location)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise CollectionError('Unexpected CDN log download URL')
    # The API can return HTTP links; use TLS for log downloads as well.
    location = 'https://' + parsed.netloc + parsed.path
    if parsed.query:
        location += '?' + parsed.query
    counts = Counter()
    lines = matched = 0
    with urlopen(location, timeout=120) as response:
        with gzip.GzipFile(fileobj=response) as archive:
            with io.TextIOWrapper(archive, encoding='utf-8', errors='strict') as source:
                for line in source:
                    if not line.strip():
                        continue
                    lines += 1
                    record = LOG_LINE.match(line)
                    if record is None:
                        # Fail rather than checkpoint an unsupported/custom format.
                        raise CollectionError('Unsupported CDN offline log format; use the default CDN format')
                    matched += 1
                    if record['method'] != 'GET' or record['status'] != '200':
                        continue
                    url = urlsplit(record['url'])
                    if url.hostname != domain:
                        continue
                    path = unquote(url.path)
                    if not path.startswith(package_prefix) or not path.endswith('.notegen-plugin'):
                        continue
                    filename = path.rsplit('/', 1)[-1]
                    # Longest ID first avoids prefix collisions. Remember IDs even
                    # after a plugin/version disappears from the live market.
                    for plugin_id in plugin_ids:
                        prefix = plugin_id + '-'
                        if filename.startswith(prefix):
                            version = filename[len(prefix):-len('.notegen-plugin')]
                            if VERSION.fullmatch(version):
                                counts[(plugin_id, version)] += 1
                                break
                    else:
                        raise CollectionError('Downloaded package does not match a known market plugin')
    return counts, lines, matched


def public_stats(state):
    plugins = {}
    for plugin_id, versions in sorted(state['plugins'].items()):
        plugins[plugin_id] = {
            'downloads': sum(versions.values()), 'versions': dict(sorted(versions.items())),
        }
    return {
        'schemaVersion': 1,
        'updatedAt': state['updatedAt'],
        'windowStart': state['windowStart'],
        'windowEnd': state['windowEnd'],
        'source': 'aliyun-cdn-offline-logs',
        'domain': state['domain'],
        'metric': 'http-200-get-requests',
        'totalDownloads': sum(plugin['downloads'] for plugin in plugins.values()),
        'plugins': plugins,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lookback-days', type=int, default=7)
    parser.add_argument('--dry-run', action='store_true', help='Read and aggregate; do not write OSS')
    args = parser.parse_args()
    if not 1 <= args.lookback_days <= 29:
        raise CollectionError('lookback-days must be between 1 and 29')
    domain = os.environ['CDN_DOMAIN'].strip()
    base = urlsplit(os.environ['OSS_PUBLIC_BASE_URL'].rstrip('/') + '/')
    if base.scheme != 'https' or base.hostname != domain or base.query or base.fragment:
        raise CollectionError('OSS_PUBLIC_BASE_URL must use HTTPS and the configured CDN_DOMAIN')
    market_prefix = base.path.lstrip('/')
    package_prefix = base.path + 'packages/'
    if market_prefix != 'plugins/v1/':
        raise CollectionError('Expected the existing plugins/v1 marketplace namespace')
    bucket = oss2.Bucket(
        oss2.ProviderAuthV4(EnvironmentVariableCredentialsProvider()),
        os.environ['OSS_ENDPOINT'], os.environ['OSS_BUCKET'], region=os.environ['OSS_REGION'],
    )
    now = datetime.now(UTC).replace(microsecond=0)
    end = now.replace(minute=0, second=0)
    start = end.replace(hour=0) - timedelta(days=args.lookback_days)
    try:
        result = bucket.get_object(STATE_KEY)
        state = json.loads(result.read())
    except oss2.exceptions.NoSuchKey:
        state = {
            'schemaVersion': 1, 'domain': domain, 'packagePrefix': package_prefix,
            'plugins': {}, 'knownPluginIds': [], 'processedLogs': {},
            'windowStart': timestamp(start), 'windowEnd': timestamp(start),
        }
    if (state['schemaVersion'] != 1 or state['domain'] != domain
            or state['packagePrefix'] != package_prefix):
        raise CollectionError('Stored statistics configuration does not match this run')
    # Catch up after missed runs, within the conservative 29-day retention window.
    previous_end = parse_time(state['windowEnd'])
    earliest = end.replace(hour=0) - timedelta(days=29)
    if previous_end < start:
        if previous_end < earliest:
            print('::warning::A collection gap exceeds CDN retention; older requests cannot be recovered.')
        start = max(earliest, previous_end.replace(hour=0))
    index = json.loads(bucket.get_object(market_prefix + 'index.json').read())
    plugin_ids = set(state['knownPluginIds']) | set(state['plugins'])
    plugin_ids.update(plugin['id'] for plugin in index['plugins'])
    state['knownPluginIds'] = sorted(plugin_ids)
    ordered_ids = sorted(plugin_ids, key=lambda value: (-len(value), value))
    client = AcsClient(
        os.environ['OSS_ACCESS_KEY_ID'], os.environ['OSS_ACCESS_KEY_SECRET'], 'cn-hangzhou',
        timeout=60, auto_retry=True, max_retry_time=3,
    )
    new_logs = requests = 0
    for log in list_logs(client, domain, start, end):
        # URLs expire/change; identity must use stable metadata instead.
        identity = hashlib.sha256(encode([
            domain, log['LogName'], log['StartTime'], log['EndTime'],
        ])).hexdigest()
        if identity in state['processedLogs']:
            continue
        counts, lines, matched = count_log(log, domain, package_prefix, ordered_ids)
        for (plugin_id, version), count in counts.items():
            versions = state['plugins'].setdefault(plugin_id, {})
            versions[version] = versions.get(version, 0) + count
        state['processedLogs'][identity] = log['EndTime']
        new_logs += 1
        requests += sum(counts.values())
        print(f'Processed log {identity[:12]}: {lines} lines, {matched} parsed, {sum(counts.values())} downloads')
    if new_logs == 0:
        print('::warning::No new CDN logs found; check domain traffic, permissions and log delivery delay.')
    state['windowStart'] = min(state['windowStart'], timestamp(start))
    state['windowEnd'] = max(state['windowEnd'], timestamp(end))
    state['updatedAt'] = timestamp(now)
    # Retain checkpoints beyond the maximum permitted lookback; totals live forever.
    cutoff = timestamp(now - timedelta(days=35))
    state['processedLogs'] = {
        key: value for key, value in state['processedLogs'].items() if value >= cutoff
    }
    if not args.dry_run:
        headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
        # The workflow concurrency group provides the single-writer guarantee.
        # Commit all counters and checkpoints in one object write.
        # If public output fails, the next run rebuilds it from committed state.
        bucket.put_object(STATE_KEY, encode(state), headers=headers)
        bucket.put_object(PUBLIC_KEY, encode(public_stats(state)), headers={
            'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=300',
        })
    print(f'{"Dry run" if args.dry_run else "Published"}: {new_logs} new logs, {requests} new downloads')


if __name__ == '__main__':
    try:
        main()
    except CollectionError as error:
        print(f'::error::{error}', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # SDK/HTTP exceptions may contain signed URLs or credentials. Do not dump them.
        print(f'::error::Plugin statistics collection failed ({type(error).__name__}). '
              'Check configuration, RAM permissions, CDN format and OSS state.', file=sys.stderr)
        sys.exit(1)
