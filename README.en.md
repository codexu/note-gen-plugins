# NoteGen Plugins

[简体中文](README.md)

Source workspace for official NoteGen plugins and the static marketplace
release tooling.

> [!IMPORTANT]
> Signed official plugin packages and the production index
> are published through GitHub Actions to OSS/CDN and
> [GitHub Releases](https://github.com/codexu/note-gen-plugins/releases).
> Clients need marketplace support and the matching embedded root public key.
> Community submissions are not open yet.

## Official plugins

| Plugin | ID | Purpose |
| --- | --- | --- |
| [Bookmarks](plugins/bookmarks) | `top.notegen.bookmarks` | Bookmark notes with content previews and drag to reorder |
| [Daily Notes](plugins/daily-notes) | `top.notegen.daily-notes` | Open or create a note for the current logical day |
| [Editor Statistics](plugins/editor-statistics) | `top.notegen.editor-statistics` | Show local Markdown writing statistics in the status bar |
| [Document Preview](plugins/document-preview) | `top.notegen.document-preview` | Offline PDF, DOCX, XLSX and PPTX previews |
| [Iconize](plugins/iconize) | `top.notegen.iconize` | File and folder icons or Emoji |
| [Korean Language Pack](plugins/language-pack-ko) | `top.notegen.language-pack-ko` | Korean interface translations |
| [Dynamic Templates](plugins/templates) | `top.notegen.templates` | Markdown templates and custom fields |
| [NoteGen Themes](plugins/themes) | `top.notegen.themes` | Three themes with light and dark palettes |

The five new plugins require NoteGen 0.37.1 or later and their declared plugin API.

These are independent plugins. They use only the public host contract
from
[`@notegen/plugin-api`](https://github.com/codexu/note-gen-plugin-sdk/tree/main/packages/plugin-api),
do not import NoteGen application internals, and are not loaded as built-in
plugins.

## Official plugin language requirements

Every official plugin under `plugins/`, including themes and language packs, must support English (`en`) and Simplified Chinese (`zh-CN`). Declare both in `locales`, set `defaultLocale` to `en`, and use `%name%` and `%description%` for package metadata. Commands, permissions, settings and views must reference translated text. Both dictionaries must have the same keys and non-empty values.

Buttons, notices and custom settings interfaces must also support both languages. Technical identifiers, example paths and user content are not translated. The host selects the NoteGen interface language; plugins provide translations and fall back to English for unsupported languages. Document previews receive `notegen:preview-init.locale`; older hosts that omit it use English.

Provide Chinese `README.md` and `USAGE.zh-CN.md`, and English `README.en.md` and `USAGE.md`. A language pack's target language does not replace this requirement. Registered market names and descriptions must match the package dictionaries; market generation reads official English and Chinese metadata from those dictionaries. Unregistered plugins are not automatically published.

`pnpm validate` includes `validate:localizations`, so existing CI and release workflows enforce locale declarations, matching message keys, translated contribution references, documentation presence and registered market metadata consistency. This does not assess translation quality: review the list and settings pages in both NoteGen interface languages before release.

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

Official packages are published. Community registration, PR verification, and independent signed-package ingestion are implemented; production opening remains pending real-client acceptance and repository protection setup.

See [Submit a community plugin](community/README.en.md) for the supported registry format. Authors keep source in their own repositories and submit registration PRs. Merge does not publish: a maintainer dispatches the release workflow on main after review.

## Static distribution design

### Localized marketplace metadata

Maintain `localizations` on registry entries, with complete `name` and
`description` values per locale. Official entries provide `en` and `zh-CN`.
The root-signed index carries these translations without downloading or executing
the plugin, and published package contents remain unchanged.

Clients match the full locale, then its base language. Chinese locales fall back
to `zh-CN`, followed by `en` and the original `name`/`description`. Search matches
all supplied translations. Each plugin allows at most 20 locales; name and
description limits are 120 and 2000 UTF-8 bytes respectively.

Release compatible clients before setting the repository Actions variable
`PLUGIN_MARKET_LOCALIZATIONS=true` and publishing a new index generation.
The generator option is `--localized-metadata true`; new translations are omitted
by default. Old clients reject unknown fields: if they must retain access to v1,
introduce a separate newer index endpoint before enabling localized metadata.
New clients can still read older indexes. Existing published translations survive
generation and scheduled renewal; disabling the variable does not remove them.
The production switch was enabled on 2026-09-10 and the bilingual index is live.
Clients must support the `localizations` field.

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

### Release a plugin update

1. Develop on this repository's `main`. Bump both `plugin.json` and `package.json`
   for each changed plugin, and update its `changelog` in `market/registry.json`,
   usage documents, and translations. A published version cannot contain different
   bytes. Unchanged plugins do not need a version bump.
2. Commit and push, confirm CI passes, then select **Release signed plugin market
   → Run workflow → main** in GitHub Actions:

   | Input | Value |
   | --- | --- |
   | `release_tag` | A new unique tag, such as `plugins-v1-20260910-r2`; never reuse an existing tag for a new commit |
   | `generation` | A positive integer greater than the highest verified live generation; scheduled runs may use a run ID larger than a Unix timestamp |
   | `validity_days` | Usually `14`; supported range is 1–14 days |
   | `first_release` | `false` for updates; `true` only after confirming no marketplace has ever been published |

3. Actions checks out the pinned SDK, builds, validates, tests and packs the
   plugins, publisher-signs their archives, then generates and root-signs the
   index. It publishes GitHub Release assets, uploads through the native Alibaba
   Cloud OSS SDK, and updates the index pointers served by the CDN.
4. Confirm the run succeeded and the live index includes the new version. Verify
   the index signature, CDN/GitHub package SHA-256, publisher signature and file
   integrity before testing installation and updates in NoteGen.

Each manual publication builds and packs **all official plugins** and attaches
the resulting assets to its GitHub Release. Existing versions retain their
original download URLs. OSS objects with matching SHA-256 metadata are skipped;
missing objects are uploaded, and conflicting immutable objects are rejected.

Ordinary plugin changes do not need an npm release. When the SDK changes, follow
the [SDK release procedure](https://github.com/codexu/note-gen-plugin-sdk#maintainer-release-procedure)
first and update `PLUGIN_SDK_REF` when official plugins should adopt that reviewed
SDK commit. SDK, marketplace and NoteGen application releases are independent.

### Scheduled renewal and recovery

Monday-and-Thursday runs renew only the signed index and reuse existing packages;
they do not rebuild or repack plugins. The 14-day validity applies to the signed
index, not the installed plugin's lifetime or the update-check interval.

For interrupted uploads, use **Re-run jobs** on the original Actions run to keep
the same source commit and tag. If code must change, publish from a new commit
with a new tag and higher generation. Do not delete old releases, overwrite
published package versions, or bypass history checks with `first_release`.

### Release configuration and integrity constraints

The repository includes two workflows. `CI` checks out an immutable SDK commit, builds
the API, CLI, and test host, validates all three official plugins, and runs their
behavior tests. `Release signed plugin market` packages and publisher-signs the
plugins, creates a root-signed index, and publishes an immutable GitHub Release.
A Monday-and-Thursday scheduled run refreshes the index with a 14-day validity
window while reusing the existing immutable plugin packages, leaving recovery
time for delayed or failed Actions runs.

Before the first release, create a GitHub Environment named
`plugin-market-production`, with reviewers if required by your team, and a no-review `plugin-market-refresh` environment
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
index; compare any proposed UTC Unix timestamp with the actual highest generation.
The workflow verifies the signature
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

## Client installation and update checks

| Installation source | Workflow | Marketplace updates |
| --- | --- | --- |
| Development | Build `.notegen/package` and import through Developer mode; rebuild and reimport after changes | No |
| Marketplace | Install from Discover after index, signature and integrity verification | Yes, for newer compatible releases |

Discover shows the catalog version. Its **Installed** button only means the same
plugin ID exists locally; it does not prove that version is installed. Inspect
the actual version and **Development / Marketplace** badge in Installed.

To test `0.1.0 → 0.1.1`, first install signed `0.1.0` through the marketplace,
then publish `0.1.1`. If the old installation is a development import, uninstall
it before installing a marketplace version. Installing the latest version directly
tests installation, not that upgrade. Do not roll back the production index to
set up an upgrade test.

The current client may reuse an unexpired catalog when opening plugin settings,
and the Updates tab does not itself fetch a fresh index. If an update is missing,
click **Refresh** in Discover, then return to Updates. If it is still absent,
check the installation source, installed version, and the release's minimum app
version, API range and platform compatibility. Refreshing never converts a
development installation into a marketplace installation.

## License

Official plugin source in this repository is released under the
[GNU GPL v3 or later](LICENSE). Future registered community plugins retain the
licenses declared by their own source repositories and manifests.

See the [NoteGen documentation](https://notegen.top) for more information.

## Withdrawal and key rotation

See the [plugin withdrawal design](docs/plugin-withdrawal-design.md) (Chinese,
draft, not implemented) for whole-plugin withdrawal, resuming publication and
historical asset retention. The configuration below describes existing version revocation.

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

## 2026-09-10 官方插件重发 / Catalog reset

官方插件仅保留 Bookmarks、每日笔记、写作统计，版本统一为 0.1.0。SDK API 版本保持 0.1.1。

本次使用显式 `reset_catalog=true`，保留更高索引 generation，但不保留旧插件和历史版本。新包和索引发布并校验后，清理 OSS `plugins/v1/` 下未被新索引引用的旧资产。日常发布保持该开关关闭。已安装更高版本或开发版本的用户需卸载旧插件后安装新的 0.1.0，不会自动降级。

## Interface visibility maintenance

NoteGen derives per-device display switches from each plugin’s `contributes.views`, `contributes.menus`, and `contributes.statusBar`. Entries are shown by default. File-menu entries inherited by tab context menus use the independent tab-menu switch. Plugins do not access private host settings.

When changing an entry, update its manifest, both README translations, and bundled USAGE documents together. Do not add duplicate display settings for new entries; Editor Statistics retains its existing workspace setting for compatibility. Hiding entries preserves commands and data. The host ignores navigation requests for hidden views, and plugins must not override user display preferences. Updated documentation requires repackaging; the new host can control existing plugin packages directly.

## Community submissions

The registration and independent-package publication path is implemented. See [Submit a community plugin](community/README.en.md) for the format, PR workflow, updates, key rotation, and revocation. Production opening remains pending protected-branch/environment setup and real-client acceptance. Merge registers a plugin; a maintainer must dispatch the release workflow on main.
