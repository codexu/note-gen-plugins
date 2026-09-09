"""Publish signed marketplace assets through the native OSS V4 API."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import oss2
from oss2.credentials import EnvironmentVariableCredentialsProvider


def upload(bucket, source, key, content_type, immutable=True):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if immutable:
        try:
            existing = bucket.head_object(key)
        except oss2.exceptions.NoSuchKey:
            pass
        else:
            if existing.headers.get('x-oss-meta-sha256') != digest:
                raise RuntimeError(f'Immutable OSS object has different or missing sha256: {key}')
            print(f'Existing immutable OSS object matches: {key}')
            return
    headers = {
        'Content-Type': content_type,
        'Cache-Control': 'public,max-age=31536000,immutable' if immutable else 'no-cache,no-store,must-revalidate',
        'x-oss-meta-sha256': digest,
    }
    if immutable:
        headers['x-oss-forbid-overwrite'] = 'true'
    bucket.put_object_from_file(key, str(source), headers=headers)
    if bucket.head_object(key).headers.get('x-oss-meta-sha256') != digest:
        raise RuntimeError(f'Uploaded OSS object metadata does not match: {key}')
    print(f'Uploaded and verified: {key}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['packages', 'index'])
    args = parser.parse_args()
    bucket = oss2.Bucket(
        oss2.ProviderAuthV4(EnvironmentVariableCredentialsProvider()),
        os.environ['OSS_ENDPOINT'], os.environ['OSS_BUCKET'], region=os.environ['OSS_REGION'],
    )
    assets = Path('release-assets')
    index = json.loads((assets / 'index.json').read_text())
    if args.mode == 'packages':
        base = urlsplit(os.environ['OSS_PUBLIC_BASE_URL'].rstrip('/') + '/')
        uploaded = set()
        for plugin in index['plugins']:
            for release in plugin['releases']:
                source = assets / f"{plugin['id']}-{release['version']}.notegen-plugin"
                if not source.is_file():
                    continue  # Older retained versions already have immutable objects.
                if hashlib.sha256(source.read_bytes()).hexdigest() != release['packageSha256']:
                    raise RuntimeError(f'Package does not match signed index: {source.name}')
                url = urlsplit(release['packageUrl'])
                if (url.scheme, url.netloc) != (base.scheme, base.netloc) or not url.path.startswith(base.path + 'packages/') or url.query or url.fragment:
                    raise RuntimeError(f'Unexpected canonical OSS package URL: {release["packageUrl"]}')
                # Reused versions retain their original signed URLs, including after
                # a GitHub release succeeds but its OSS upload is interrupted.
                upload(bucket, source, url.path.lstrip('/'), 'application/zip')
                uploaded.add(source.name)
        expected = {source.name for source in assets.glob('*.notegen-plugin')}
        if not expected or uploaded != expected:
            raise RuntimeError('Every release package must be referenced by the signed index')
    else:
        generation = str(index['generation'])
        if generation != os.environ['GENERATION']:
            raise RuntimeError('Signed index generation does not match workflow')
        for name, content_type in [('index.json', 'application/json'), ('index.sig', 'text/plain')]:
            upload(bucket, assets / name, f'plugins/v1/generations/{generation}/{name}', content_type)
        # Publish the signature first; clients reject a transient mismatched pair.
        for name, content_type in [('index.sig', 'text/plain'), ('index.json', 'application/json')]:
            upload(bucket, assets / name, f'plugins/v1/{name}', content_type, immutable=False)


if __name__ == '__main__':
    try:
        main()
    except oss2.exceptions.ServerError as error:
        # Do not dump request headers, credentials, or signed request material.
        raise SystemExit(f'OSS request failed: status={error.status}, code={error.code}, request_id={error.request_id}')
