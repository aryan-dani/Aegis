# Aegis

Aegis is a local-first desktop password manager built with Tauri, Rust, React, SQLCipher, Argon2id, and AES-256-GCM. It is designed for users who want a focused vault that runs on their machine, stores secrets locally, and avoids background sync or account-based recovery.

The application is a Windows desktop app. It is not a hosted web app.

## Core Principles

- **Local by default**: vault data is stored on the device.
- **Zero-knowledge design**: the master password is not stored and is used only to derive vault keys.
- **Layered encryption**: entries are encrypted with AES-256-GCM and the database is protected with SQLCipher.
- **Minimal network access**: update checks and optional breach checks are the only intended network-facing features.
- **Signed releases**: in-app updates are distributed through signed GitHub Release artifacts.
- **No telemetry**: Aegis does not collect analytics, usage events, or vault content.

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Release and Update Pipeline](docs/RELEASES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Quick Start

Install the latest Windows release from GitHub Releases, open Aegis, and create a vault with a master password of at least 12 characters.

After the first installer-based setup, future builds can be installed from inside the app:

1. Open Aegis.
2. Unlock the vault.
3. Open **Settings**.
4. Select **Check for updates**.
5. Install the signed update when one is available.

## Development

Requirements:

- Node.js and pnpm
- Rust through rustup
- Microsoft C++ Build Tools
- vcpkg with static OpenSSL for SQLCipher builds
- GitHub CLI for publishing releases

Install frontend dependencies:

```powershell
pnpm install
```

Run the development app:

```powershell
pnpm tauri dev
```

Build a production desktop bundle:

```powershell
pnpm tauri build
```

Publish a signed release:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Version 0.1.8 -Notes "Release notes"
```

## Important Security Notes

- Keep the updater private signing key outside the repository.
- Losing the master password means losing access to the vault.
- Windows Hello unlock is a convenience layer; the master password remains the recovery path.
- Encrypted exports should be protected with a strong backup passphrase and stored separately from the main device.
