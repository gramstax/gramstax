# Security Policy

## Supported versions

Security fixes are provided for the latest published release only. If you are
on an older version, upgrade to the latest release first and check whether the
issue still reproduces.

| Version | Supported |
| ------- | --------- |
| Latest release (see [releases](https://github.com/gramstax/gramstax/releases)) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.** Public issues
disclose the problem to everyone before a fix exists.

Report it privately through GitHub's private vulnerability reporting:
go to the **Security** tab of this repository and choose
**Report a vulnerability**. That opens a private advisory visible only to
you and the maintainers.

Please include:

- The affected package (`gramstax`, `create-gramstax`, `@gramstax/lmdb`, or
  `@gramstax/worker-thread`) and version.
- A description of the vulnerability and its impact.
- Steps to reproduce, ideally a minimal reproduction.
- Whether the issue is already public anywhere, and where.

Reports about the template engine are in scope: Gramstax renders templates
that may contain untrusted content, so template breakout, injection, and
escaping issues are security issues, not ordinary bugs. Dependency
vulnerabilities are in scope too.

## What happens next

- We aim to acknowledge a private report within a few business days.
- We will investigate, prepare a fix, and publish a patched release.
- The advisory stays private until the fix is released. We will coordinate
  disclosure with you and credit you in the advisory if you want to be
  credited.

## Ground rules for testing

- Only test against systems you own or have permission to test. Do not probe
  other people's bots, servers, or Telegram accounts.
- Do not run denial-of-service, spam, or social-engineering tests.
- Do not exfiltrate data beyond what is needed to demonstrate the issue, and
  delete anything you obtain.
