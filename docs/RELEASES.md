# Release and Update Pipeline

Aegis uses GitHub Releases and the Tauri updater plugin for signed desktop updates.

## Release Flow

The release script performs the standard release process:

1. Validates tooling and GitHub authentication.
2. Configures the Rust, SQLCipher, OpenSSL, and signing environment.
3. Updates the application version.
4. Builds signed Tauri bundles.
5. Generates `latest.json` for the updater.
6. Commits the release changes.
7. Tags the release.
8. Pushes to GitHub.
9. Uploads installer assets and updater metadata to GitHub Releases.

Run a release with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Version 0.1.8 -Notes "Describe the change"
```

## Required Files

The Tauri updater private key must exist outside the repository:

```text
%USERPROFILE%\.aegis\aegis-updater.key
```

If a signing password is used, store it in:

```text
%USERPROFILE%\.aegis\release.env
```

The repository ignores signing material. Do not commit private signing keys.

## Public Release Requirement

The update endpoint is:

```text
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

The installed desktop application fetches this endpoint without GitHub credentials. The GitHub repository or release assets must therefore be publicly readable.

If the repository is private, GitHub returns a not found response and the updater cannot read valid update metadata.

## Manifest Encoding

`latest.json` must be valid UTF-8 JSON without a byte order mark. The release script writes the file explicitly with UTF-8 no BOM because the updater is strict about JSON parsing.

## Manual Installer Helper

If a user needs to install a specific release manually, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-release.ps1 -Version 0.1.7 -Repo aryan-dani/Aegis
```

The helper downloads the release installer if it is missing locally and launches it.

## Expected Update Test

To test the update button:

1. Install version `0.1.6`.
2. Publish version `0.1.7`.
3. Open the installed `0.1.6` application.
4. Unlock the vault.
5. Open **Settings**.
6. Select **Check for updates**.

The app should detect `0.1.7`, download the signed installer, install it, and relaunch.
