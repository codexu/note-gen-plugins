# NoteGen Plugins

[简体中文](README.md)

Source workspace for official NoteGen plugins and the static marketplace
release tooling.

> [!IMPORTANT]
> Signed `0.1.0` packages for all three official plugins and the production index
> are published through GitHub Actions to OSS/CDN and
> [GitHub Releases](https://github.com/codexu/note-gen-plugins/releases).
> Clients need marketplace support and the matching embedded root public key.
> Community submissions are not open yet.

## Official plugins

| Plugin | ID | Purpose |
| --- | --- | --- |
| [Daily Notes](plugins/daily-notes) | `top.notegen.daily-notes` | Open or create a note for the current logical day |
| [Editor Statistics](plugins/editor-statistics) | `top.notegen.editor-statistics` | Show local Markdown writing statistics in the status bar |
| [Plugin Playground](plugins/plugin-playground) | `top.notegen.plugin-playground` | Interactive probes and official examples for the public plugin API |

These are independent plugins. They use only the public host contract
from
[`@notegen/plugin-api`](https://github.com/codexu/note-gen-plugin-sdk/tree/main/packages/plugin-api),
do not import NoteGen application internals, and are not loaded as built-in
plugins.

## Source ownership

This repository centrally maintains source code for **official NoteGen
plugins**. Community plugin source remains in repositories owned by each
author. In the future, this repository will register reviewed publishers,
versions, and distribution metadata instead of copying community source here.

- Public plugin API, CLI, and test tools:
  [`note-gen-plugin-sdk`](https://github.com/codexu/note-gen-plugin-sdk)
- Plugin host and secure runtime:
  [`note-gen`](https://github.com/codexu/note-gen)
- Official plugin source, marketplace registration, and signed release tooling:
  this repository

See the [Plugin Playground usage guide](plugins/plugin-playground/USAGE.md) for manual capability testing.

## Local development

Node.js 20 or newer, pnpm 10, and a reviewed SDK revision are required. Check
the SDK out at the ignored `.sdk` path, using the same full commit SHA stored in
the repository variable `PLUGIN_SDK_REF`:

```bash
git clone https://github.com/codexu/note-gen-plugin-sdk.git .sdk
git -C .sdk checkout <the full 40-character PLUGIN_SDK_REF commit SHA>
pnpm install --frozen-lockfile
pnpm build
pnpm validate
pnpm test
pnpm run plugin:pack
```

You can also target one plugin:

```bash
pnpm --filter @notegen/plugin-daily-notes build
pnpm --filter @notegen/plugin-editor-statistics validate
```

Each plugin's `package.json` version must match `plugin.json#version`. Builds
use `@notegen/plugin-cli` and write the development package to
`.notegen/package` inside that plugin directory.

The committed `pnpm-lock.yaml` locks dependencies for both the official plugins
and `.sdk/packages/*`. CI uses `--frozen-lockfile`, so any SDK revision that
changes dependencies must update `PLUGIN_SDK_REF` and the lockfile in the same
review. The `.sdk` checkout itself is never committed. Community authors still
consume the SDK through npm; the source checkout is limited to the reproducible
official-plugin release chain.

## Marketplace status

Once the marketplace opens, this repository is intended to contain:

- reviewable registration sources for community plugins and publishers;
- review policies and automated validation;
- release tooling that generates the signed marketplace index;
- immutable fallback distribution assets published through GitHub Releases.

There is currently no “open a pull request to publish” process. Do not submit a
custom community-plugin directory or JSON format. Adding official plugin source
to this repository does not publish it to the marketplace.

## Static distribution design

The serverless marketplace uses object storage and a CDN as its primary source,
with GitHub Release assets as a fallback. The client tries:

```text
https://download.notegen.top/plugins/v1/index.json
https://download.notegen.top/plugins/v1/index.sig

https://github.com/codexu/note-gen-plugins/releases/latest/download/index.json
https://github.com/codexu/note-gen-plugins/releases/latest/download/index.sig
```

The client does not consume the repository's `main` branch, Raw files, or
ordinary directories as a marketplace source. Committing official source or an
unsigned index therefore cannot open the marketplace.

## Trust boundary

The marketplace uses two Ed25519 signature layers:

1. The marketplace root public key embedded in NoteGen verifies the exact bytes
   of `index.json` against `index.sig`.
2. Publisher public keys registered by the root index verify the package's
   `signature.sig`, which covers the canonicalized `plugin.json` and
   `integrity.json`.

During installation, NoteGen also checks the package SHA-256 and verifies every
file listed in `integrity.json`. Any failure stops installation; there is no
fallback to an unverified package.

The production root and official publisher keys are configured, and identical
signed artifacts are published to OSS/CDN and GitHub Releases. Clients must embed
the production root public key. Local builds that still use the placeholder fail
closed before downloading anything. Publishing the marketplace does not update
installed NoteGen applications.

## Maintainer release procedure

The repository includes two workflows. `CI` checks out an immutable SDK commit, builds
the API, CLI, and test host, validates all three official plugins, and runs their
behavior tests. `Release signed plugin market` packages and publisher-signs the
plugins, creates a root-signed index, and publishes an immutable GitHub Release.
A Monday-and-Thursday scheduled run refreshes the index with a 14-day validity
window while reusing the existing immutable plugin packages, leaving recovery
time for delayed or failed Actions runs.

Before the first release, create a reviewer-protected GitHub Environment named
`plugin-market-production` and a no-review `plugin-market-refresh` environment
used only by scheduled refreshes. Configure the full credentials in production;
the refresh environment needs only the root signing key, public metadata, and
OSS credentials required to renew an unchanged catalog:

- Secrets: `PUBLISHER_PRIVATE_KEY_B64`, `MARKET_ROOT_PRIVATE_KEY_B64`;
- Variables: `PUBLISHER_PUBLIC_KEY_JSON`, `MARKET_ROOT_PUBLIC_KEY`;
- OSS secrets: `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`;
- OSS variables: `OSS_ENDPOINT`, `OSS_REGION`, `OSS_BUCKET`, `OSS_PUBLIC_BASE_URL`;
- repository variable: `PLUGIN_SDK_REF`, set to a full 40-character commit SHA.

The private-key values are Base64 encodings of their PEM files.
`PUBLISHER_PUBLIC_KEY_JSON` follows `market/publisher.example.json`. Configure
the same root public key as the `PLUGIN_MARKET_ROOT_PUBLIC_KEY` Actions Variable
in the NoteGen repository; production app builds validate and embed that value.

For a manual publication, `generation` must be greater than the current live
index; a UTC Unix timestamp is recommended. The workflow verifies the signature
and structure of each OSS, GitHub latest, and requested-tag candidate before
selecting the highest generation. Different verified bytes for the same generation
fail publication. An interrupted OSS pointer update can recover from a valid
GitHub copy. If no previous index exists, the manual run proceeds only when
`first_release` is explicitly selected; that option cannot reset existing catalog
bytes when all candidates fail verification. OSS packages and generation
snapshots use immutable paths with one-year caching; the current index and
signature pointers disable caching. Every release records the OSS primary URL
and GitHub Release mirror and verifies either download against the same SHA-256.
A retry accepts an existing GitHub or OSS object only when its bytes match. If
a higher generation has superseded that release, the workflow refuses to move
the live pointer back to the older generation.

The release tag targets the exact `GITHUB_SHA` used for the build; existing tags
must resolve to that same commit. `release-metadata.json` and the release notes
record the source commit and checked-out SDK SHA. Scheduled index refreshes do
not rebuild the SDK, so `sdkCommit` is `null`. Use Actions' Re-run jobs to retain
the original source commit; scheduled retries also retain their run-ID-based tag.

Each release records its own permission summary so clients choosing an older
compatible version use that version's permissions. Generation and refresh preserve
existing summaries and backfill missing legacy fields from the previous plugin
entry's `permissions`. Each plugin can contain at most 100 releases. Adding the
101st version fails before index signing and requires an explicitly reviewed
retention change; the tooling never silently drops versions needed by older clients.

> [!CAUTION]
> Never upload a marketplace root private key, publisher private key, recovery
> material, or other signing credentials to this repository, an issue, a pull
> request, GitHub Actions logs, or a release.

## License

Official plugin source in this repository is released under the
[GNU GPL v3 or later](LICENSE). Future registered community plugins retain the
licenses declared by their own source repositories and manifests.

See the [NoteGen documentation](https://notegen.top) for more information.

## Withdrawal and key rotation

Registry plugin rows can declare `revocations`, mapping released versions to a
non-empty reason (up to 500 characters). Higher-generation signed indexes carry
these reasons as `release.revoked`; refreshed hosts stop the affected version.
Offline hosts cannot learn a withdrawal until they receive an updated index.
Scheduled renewal preserves withdrawals. Keep withdrawn versions in history.

For publisher key rotation, declare up to 16 `{ keyId, publicKey }` entries in
the registry's top-level `previousPublisherKeys`, then release a new version
with the new key. Historical packages retain their `publisherKeyId`; do not
re-sign immutable versions. The separate publisher credential document retains
its original three-field format. Root-key rotation still requires an app update.

Community submissions remain closed pending the documented review and real-host
release acceptance process. See [the maintainer checklist](COMMUNITY-REVIEW.md).
