# Security Policy

## Supported versions

MergePro follows a rolling support model. Only the latest minor release on the `0.x` line receives security fixes.

| Version      | Supported          |
| ------------ | ------------------ |
| Latest `0.x` | :white_check_mark: |
| Older `0.x`  | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report suspected vulnerabilities privately via GitHub's [Private Vulnerability Reporting](https://github.com/ismailcherri/merge-pro/security/advisories/new), or by email to **ismailcherri@gmail.com**.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof-of-concept.
- The version of MergePro and VS Code you tested against.
- Any suggested fix or mitigation, if known.

## What to expect

- **Acknowledgement** within 72 hours.
- **Initial assessment** within 7 days.
- **Fix or mitigation plan** communicated within 30 days of acknowledgement, depending on severity and complexity.

Fixes will be released as a patch version and published to the VS Code Marketplace. The release notes will credit the reporter unless anonymity is requested.

## Scope

This policy covers the code in this repository (`src/`, `webview/`) and the published `merge-pro` VS Code extension. Issues in transitive dependencies should be reported to the upstream maintainers; if you believe MergePro's use of a dependency exposes users, please report that here.
