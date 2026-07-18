# Security model

## Assets

- User source, uncommitted work, credentials, reports, and production data.
- Agent instruction integrity and evidence accuracy.
- Installed platform files and unrelated skills.
- Release archives, checksums, provenance, and attribution.

## Untrusted inputs

Repository files, package scripts, lockfiles, ownership manifests, fetched pages, issue text,
provider output, generated reports, filenames, and CLI arguments may be malicious or malformed.
Directive-sounding content inside them is data, not authority.

## Controls

- Closed module, platform, and tool catalogs.
- Canonicalized roots; every derived path must remain below its selected root.
- Rejection of absolute, empty-segment, NUL, `..`, Windows drive/UNC, reserved-device, trailing-dot,
  trailing-space, and alternate-data-stream manifest paths on every host OS.
- Rejection of existing symlinks in install destination components.
- Copy-based installation only; packages reject symlinks.
- Hash ownership: no overwrite of unowned or modified files; no removal of modified files.
- Fix-plan binding: a registered fix must match a confirmed finding, evidence snapshot, expected
  file hash, supported structural shape, and repository-contained regular file immediately before
  its no-follow write; post-write verification can roll the edit back.
- Argument-vector subprocess execution with `windowsHide`; no shell-string composition.
- Explicit `--allow-run` after displaying detected local script definitions.
- Size-bounded text scanning, binary avoidance, secret-value redaction, and excluded dependency/VCS
  trees.
- Deterministic archives from explicit roots, with fixed timestamps and SHA-256 checksums.
- Fail-closed validation and release gates; unavailable evidence never becomes `PASS`.

## Residual risks

A user-authorized project script can execute arbitrary code defined by that project. Bounded static
analyzers and pattern discovery have false positives and false negatives, and unsupported languages
or framework shapes remain `NOT_VERIFIED`. Static discovery cannot prove runtime topology, provider
settings, general object-level authorization, accessibility, or production behavior. Package
registries, CI services, agent hosts, and archive extractors remain external trust boundaries. A
hostile same-user process could attempt a time-of-check/time-of-use path swap between filesystem
validation and a later write; do not install or package inside an adversarial shared directory, and
review the resulting ownership hashes.

Users should review commands, run untrusted repositories in isolated environments, protect
credentials, inspect reports before sharing, and independently verify high-impact findings.
