# Submit a community plugin

Keep source in your own repository and submit registration through a PR. After review and merge, a NoteGen maintainer runs the marketplace release workflow; merging is not publication. Production enablement still requires branch/environment protection and real-client acceptance with an independent publisher.

## Author workflow

1. Develop with a compatible SDK. Commit source, lockfile, license, README, and offline USAGE.md; verify behavior in the desktop client.
2. Build from a fixed 40-character source commit. Pack and sign with your own Ed25519 publisher key. Never submit private keys.
3. Upload the final `.notegen-plugin` to a versioned GitHub Release in the source repository. Record its SHA-256 and retain the asset.
4. Edit `community/registry.json`. Register your publisher once; add the plugin and prepend each new release. Existing records are immutable.
5. Complete the PR template with screenshots, permission explanations, and tested client/system versions. Maintainers verify identity, source, permissions, license, and actual behavior before merging.
6. After the maintainer publishes, install through Discover. Development imports do not participate in marketplace updates.

The full JSON example is in [the registration reference](README.md#登记格式). The enforced format is implemented by `tools/community.py`:

- Root: `schemaVersion: 1`, `publishers`, `plugins`.
- Publisher: `id`, `name`, `repository`, `keyId`, `publicKey`; optional `previousKeys: [{ keyId, publicKey }]`.
- Plugin: `id`, `publisherId`, `repository`, `categories`, `releases`; optional `revocations: { version: reason }`.
- Release: `version`, `sourceCommit`, `packageUrl`, `packageSha256`, `publisherKeyId`, `changelog`, `buildInstructions`, `permissionsReason`, `testedOn`.

All fields above are required unless marked optional; unknown fields are rejected. The `notegen` publisher and `top.notegen.*` IDs are reserved. Publisher IDs use 3–80 lowercase letters, digits and hyphens, starting with a letter. Repository URLs use plain `https://github.com/owner/repo` without `.git`; plugin repository must match the signed manifest. Assets must use that repository's `/releases/download/tag/file.notegen-plugin` URL without queries or fragments. The manifest supplies name, description, license, compatibility, and permission metadata. A license is required; only desktop packages are accepted.

Community submissions cannot set official, featured, or verified flags. The generated entry uses official=false and featured=false; publisher verification badges are not automatically granted. Limits are 99 community publishers, 100 releases per plugin, and 20 MiB per download, plus the SDK's archive limits.

## Verification and updates

PR CI compares registration history with the base commit and checks new packages using the pinned SDK verifier. It never executes author code and has no production signing or OSS credentials. Existing release records are not downloaded again in incremental PR checks. Production rechecks every unpublished version and reuses only root-verified published history, so removed upstream assets do not block revocation.

For a full local check, first prepare/build `.sdk` as documented in the repository README, then run:

```bash
python3 tools/community.py --artifacts /tmp/notegen-community-packages --output /tmp/notegen-community-catalog.json
```

Use fresh output paths. Generated files are not submitted. Signature verification does not prove source reproducibility, publisher ownership, or correct behavior; those remain human review items.

Prepend new versions without changing historical records. Rotate keys by preserving the old key in previousKeys and registering the new current key; old releases retain their publisherKeyId. Independently confirm identity for rotation. Add a version-to-reason revocations entry for affected versions; existing revocations cannot be removed or changed. Clients receive revocations when they refresh the index, not instantly while offline. Cross-publisher or repository transfers require a new plugin ID in this first version.

## Maintainer enablement

Protect main with required CI and CODEOWNERS review. CODEOWNERS alone does not enable protection. Require approval and main-only deployments for the plugin-market-production environment; verify the immutable PLUGIN_SDK_REF and existing signing/OSS configuration.

Review source, lockfile, keys, permissions, license, and usage. Rebuild author source in isolation, outside the signing environment. Record the source SHA, package digest, keyId, tested client versions, and review results in the PR.

After merge, dispatch Release signed plugin market on main with a new release tag and higher generation. Normally keep first_release and reset_catalog false. Community packages retain their independent publisher signature; the root key signs only the merged index. Both OSS/CDN and GitHub Releases receive the same package bytes. Scheduled refreshes renew the existing index and do not publish new registrations.

Before announcing open submissions, complete first install, update, permission changes, revocation, and key rotation using an independent publisher in real clients. This repository change does not claim that acceptance is complete. Catalog resets cannot erase published community history. Interrupted releases use the existing immutable release recovery path.
