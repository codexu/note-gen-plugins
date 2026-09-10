"""Validate community registrations and stage independently signed packages.

Only the pinned SDK verifier inspects archives; no author code is executed.
Production consumes this output before loading signing credentials.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request

MAX_PACKAGE = 20 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def object_fields(value, required, optional=()):
    require(isinstance(value, dict), 'Expected an object')
    require(set(required) <= value.keys() <= set(required) | set(optional),
            f'Expected fields {required}; optional {optional}')


def string(value, limit=2000):
    require(isinstance(value, str) and 0 < len(value) <= limit and value.strip(), 'Invalid string')
    require(not any(ord(c) < 32 for c in value), 'Control characters are not allowed')
    return value


def unique(items, field):
    require(isinstance(items, list), 'Expected an array')
    keys = [item[field] for item in items]
    require(len(keys) == len(set(keys)), f'Duplicate {field}')


def public_key(value):
    object_fields(value, ['keyId', 'publicKey'])
    raw = base64.b64decode(value['publicKey'], validate=True)
    require(len(raw) == 32 and base64.b64encode(raw).decode() == value['publicKey'], 'Invalid Ed25519 key')
    require(value['keyId'] == 'ed25519-' + hashlib.sha256(raw).hexdigest(), 'keyId mismatch')


def repository(value):
    require(isinstance(value, str) and re.fullmatch(r'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', value),
            'Repository must be a plain GitHub owner/repository URL')
    return value


def strict_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def read_json(path):
    return json.loads(Path(path).read_text(), object_pairs_hook=strict_pairs)


def validate(data):
    object_fields(data, ['schemaVersion', 'publishers', 'plugins'])
    require(data['schemaVersion'] == 1, 'Unsupported schema version')
    unique(data['publishers'], 'id')
    unique(data['plugins'], 'id')
    require(len(data['publishers']) <= 99 and len(data['plugins']) <= 1000, 'Registry quota exceeded')
    publishers = {}
    for p in data['publishers']:
        object_fields(p, ['id', 'name', 'repository', 'keyId', 'publicKey'], ['previousKeys'])
        require(re.fullmatch(r'[a-z][a-z0-9-]{2,79}', p['id']) and p['id'] != 'notegen', 'Invalid or reserved publisher ID')
        string(p['name'], 120)
        repository(p['repository'])
        public_key({k: p[k] for k in ['keyId', 'publicKey']})
        old = p.get('previousKeys', [])
        require(isinstance(old, list) and len(old) <= 16, 'Too many previous keys')
        for key in old:
            public_key(key)
        unique([{'keyId': p['keyId']}, *old], 'keyId')
        publishers[p['id']] = p
    for p in data['plugins']:
        object_fields(p, ['id', 'publisherId', 'repository', 'categories', 'releases'], ['revocations'])
        require(re.fullmatch(r'[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+', p['id']) and len(p['id']) <= 160
                and not p['id'].startswith('top.notegen.'), 'Invalid or reserved plugin ID')
        require(p['publisherId'] in publishers, 'Unknown publisher')
        repository(p['repository'])
        require(isinstance(p['categories'], list) and len(p['categories']) <= 20, 'Invalid categories')
        for category in p['categories']:
            string(category, 80)
        unique(p['releases'], 'version')
        require(1 <= len(p['releases']) <= 100, 'Expected 1–100 releases, newest first')
        for release in p['releases']:
            object_fields(release, ['version', 'sourceCommit', 'packageUrl', 'packageSha256', 'publisherKeyId',
                                    'changelog', 'buildInstructions', 'permissionsReason', 'testedOn'])
            require(re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', release['version']), 'Invalid version')
            require(re.fullmatch(r'[a-f0-9]{40}', release['sourceCommit']), 'sourceCommit must be a full commit SHA')
            require(re.fullmatch(r'[a-f0-9]{64}', release['packageSha256']), 'Invalid package SHA-256')
            prefix = p['repository'] + '/releases/download/'
            url = urllib.parse.urlsplit(release['packageUrl'])
            require(release['packageUrl'].startswith(prefix) and not url.query and not url.fragment
                    and re.fullmatch(r'[^/]+/[^/]+\.notegen-plugin', release['packageUrl'][len(prefix):]),
                    'Use a versioned GitHub Release asset from the plugin repository')
            keys = [publishers[p['publisherId']]['keyId'], *[k['keyId'] for k in publishers[p['publisherId']].get('previousKeys', [])]]
            require(release['publisherKeyId'] in keys, 'Unknown release signing key')
            for field in ['changelog', 'buildInstructions', 'permissionsReason', 'testedOn']:
                string(release[field], 4000)
        revocations = p.get('revocations', {})
        require(isinstance(revocations, dict), 'Invalid revocations')
        for version, reason in revocations.items():
            require(version in [r['version'] for r in p['releases']], 'Cannot revoke unknown release')
            string(reason, 500)
    return data


def immutable(previous, current):
    """Merged registration history cannot disappear or change identity/bytes."""
    for old in previous['publishers']:
        new = next((p for p in current['publishers'] if p['id'] == old['id']), None)
        require(new is not None, 'Cannot remove a publisher')
        require(new['repository'] == old['repository'], 'Publisher ownership changes need a new ID')
        keys = [{k: new[k] for k in ['keyId', 'publicKey']}, *new.get('previousKeys', [])]
        for key in [{k: old[k] for k in ['keyId', 'publicKey']}, *old.get('previousKeys', [])]:
            require(key in keys, 'Key rotation must retain previous keys')
    for old in previous['plugins']:
        new = next((p for p in current['plugins'] if p['id'] == old['id']), None)
        require(new is not None, 'Cannot remove plugin history; revoke affected versions instead')
        require((new['publisherId'], new['repository']) == (old['publisherId'], old['repository']), 'Cannot transfer a plugin identity')
        retained = [r for r in new['releases'] if r['version'] in {r['version'] for r in old['releases']}]
        require(retained == old['releases'] and new['releases'][-len(old['releases']):] == old['releases'],
                'Existing release records are immutable; prepend new versions')
        for version, reason in old.get('revocations', {}).items():
            require(new.get('revocations', {}).get(version) == reason, 'Cannot remove or change a revocation')


class GitHubRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urllib.parse.urlsplit(newurl)
        require(url.scheme == 'https' and url.hostname in {'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}
                and not url.username and not url.password and url.port in {None, 443}, 'Unexpected asset redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, target):
    opener = urllib.request.build_opener(GitHubRedirect())
    with opener.open(urllib.request.Request(url, headers={'User-Agent': 'NoteGen-Market-Review'}), timeout=60) as response:
        with target.open('xb') as output:
            size = 0
            while chunk := response.read(64 * 1024):
                size += len(chunk)
                require(size <= MAX_PACKAGE, 'Package exceeds 20 MiB')
                output.write(chunk)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--registry', default='community/registry.json')
    parser.add_argument('--previous-registry')
    parser.add_argument('--base-ref')
    parser.add_argument('--changes-only', action='store_true')
    parser.add_argument('--previous-index')
    parser.add_argument('--artifacts', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--sdk-cli', default='.sdk/packages/plugin-cli/dist/bin.js')
    args = parser.parse_args()
    data = validate(read_json(args.registry))
    base_registry = {'publishers': [], 'plugins': []}
    require(not args.changes_only or args.base_ref, '--changes-only requires --base-ref')
    # This path must be the root-verified index supplied by the production workflow.
    previous = read_json(args.previous_index) if args.previous_index else {'plugins': [], 'publishers': []}
    if args.previous_registry:
        immutable(validate(read_json(args.previous_registry)), data)
    if args.base_ref:
        require(re.fullmatch(r'[a-f0-9]{40}', args.base_ref), 'Base ref must be a commit SHA')
        listed = subprocess.run(['git', 'ls-tree', args.base_ref, '--', 'community/registry.json'], check=True, capture_output=True, text=True)
        if listed.stdout:
            prior = subprocess.run(['git', 'show', args.base_ref + ':community/registry.json'], check=True, capture_output=True, text=True)
            base_registry = validate(json.loads(prior.stdout, object_pairs_hook=strict_pairs))
            immutable(base_registry, data)
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    result = {'schemaVersion': 1, 'publishers': data['publishers'], 'plugins': []}
    with tempfile.TemporaryDirectory(prefix='notegen-community-') as temp:
        for plugin in data['plugins']:
            publisher = next(p for p in data['publishers'] if p['id'] == plugin['publisherId'])
            releases, latest = [], None
            for release in plugin['releases']:
                base_plugin = next((p for p in base_registry['plugins'] if p['id'] == plugin['id']), None)
                if args.changes_only and base_plugin and release in base_plugin['releases']:
                    continue
                old = next((p for p in previous['plugins'] if p['id'] == plugin['id']), None)
                prior = next((r for r in old['releases'] if r['version'] == release['version']), None) if old else None
                if prior:
                    require(not old.get('official') and old['publisherId'] == plugin['publisherId']
                            and old.get('repository') == plugin['repository'], 'Published plugin ownership differs')
                    old_publisher = next(p for p in previous['publishers'] if p['id'] == old['publisherId'])
                    require(prior['packageSha256'] == release['packageSha256']
                            and prior.get('publisherKeyId', old_publisher['keyId']) == release['publisherKeyId'], 'Published release is immutable')
                    latest = latest or {**old, 'permissions': {p: {} for p in prior.get('permissions', old['permissions'])}}
                    releases.append({**release, **{k: prior[k] for k in ['minAppVersion', 'apiVersion', 'platforms']},
                                     'permissions': prior.get('permissions', old['permissions'])})
                    continue
                name = f"{plugin['id']}-{release['version']}.notegen-plugin"
                target = artifacts / name
                download(release['packageUrl'], target)
                require(hashlib.sha256(target.read_bytes()).hexdigest() == release['packageSha256'], 'Package digest mismatch: ' + name)
                key = next(k for k in [publisher, *publisher.get('previousKeys', [])] if k['keyId'] == release['publisherKeyId'])
                key_path = Path(temp) / 'publisher.json'
                key_path.write_text(json.dumps({'algorithm': 'Ed25519', 'keyId': key['keyId'], 'publicKey': key['publicKey']}))
                verified = subprocess.run(['node', args.sdk_cli, 'verify', str(target), '--public-key', str(key_path), '--require-signature', '--json'],
                                          check=True, capture_output=True, text=True, timeout=120)
                info = json.loads(verified.stdout)
                require(info.get('signatureVerified') is True, 'SDK did not verify publisher signature')
                manifest = info['manifest']
                require(manifest['id'] == plugin['id'] and manifest['version'] == release['version'], 'Manifest identity differs from registration')
                require(manifest.get('repository') == plugin['repository'], 'Manifest repository differs from registration')
                require(manifest.get('license'), 'Manifest must declare a license')
                require(manifest['platforms'] == ['desktop'], 'Only desktop plugins can be submitted')
                latest = latest or manifest
                releases.append({**release, 'minAppVersion': manifest['minAppVersion'], 'apiVersion': manifest['apiVersion'],
                                 'platforms': manifest['platforms'], 'permissions': sorted(manifest['permissions'])})
            result['plugins'].append({**plugin, 'manifest': latest, 'releases': releases})
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"Verified {len(data['plugins'])} community plugins; prepared {output}")


if __name__ == '__main__':
    main()
