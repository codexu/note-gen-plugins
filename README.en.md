# NoteGen Plugins

[简体中文](README.md)

Registration, review, and static distribution repository for the NoteGen
community plugin marketplace.

> [!IMPORTANT]
> This repository is public, but the remote marketplace and community
> submissions are not open. There is currently no signed index, signature, or
> community plugin package that NoteGen can consume. Do not submit a custom
> directory or JSON format. There is no “open a pull request to publish” process.

## Repository responsibilities

Once the marketplace opens, this repository is intended to contain:

- reviewable registration sources for community plugins and publishers;
- review policies and automated validation;
- release tooling that generates the signed marketplace index;
- immutable fallback distribution assets published through GitHub Releases.

This repository does not centralize community plugin source code and does not
define the host API. Authors maintain source in their own repositories. The
public TypeScript contract lives in
[`note-gen-plugin-sdk`](https://github.com/codexu/note-gen-plugin-sdk), while
the plugin host and secure runtime live in
[`note-gen`](https://github.com/codexu/note-gen).

Third-party plugins currently target desktop only. Official built-in plugins
ship with NoteGen and do not depend on the remote marketplace.

## Static distribution

The serverless marketplace design uses object storage and a CDN as the primary
source, with GitHub Release assets as a fallback. The client tries:

```text
https://download.notegen.top/plugins/v1/index.json
https://download.notegen.top/plugins/v1/index.sig

https://github.com/codexu/note-gen-plugins/releases/latest/download/index.json
https://github.com/codexu/note-gen-plugins/releases/latest/download/index.sig
```

The client does not consume the repository's `main` branch, Raw files, or
ordinary directories as a marketplace source. Committing an empty index to a
branch would neither open the marketplace nor create a valid release.

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

The root public key in the current marketplace client implementation is still a
safe placeholder. The remote marketplace fails closed before downloading
anything, while official built-in plugins remain available.

> [!CAUTION]
> Never upload a marketplace root private key, publisher private key, recovery
> material, or other signing credentials to this repository, an issue, a pull
> request, GitHub Actions logs, or a release.

## Why submissions are not open

Before launch, maintainers still need to:

- generate and store an offline marketplace root key and compile its public key
  into NoteGen;
- publish a stable plugin registration format and publisher-key process;
- provide official packaging, signing, and verification tools;
- establish reproducible-build, permission-diff, malicious-content, and license
  review;
- establish CI, human review, release retention, and security-response
  procedures;
- continuously generate and publish the same signed index through the CDN and
  GitHub Releases.

An index may expire no more than 14 days in the future, its `generation` must
increase monotonically, and content under one generation cannot be rewritten.
The current client also has no publisher transfer, key rotation, withdrawal
feed, remote blocklist, or forced-disable mechanism, so the project cannot yet
promise a complete incident-response path.

Authors may still build plugins, import them locally in NoteGen desktop, and
publish source in their own repositories. When submissions open, this
repository and the official documentation will publish the supported directory
layout, commands, pull-request workflow, and review rules available at that
time.

See the [NoteGen documentation](https://notegen.top) for more information.
