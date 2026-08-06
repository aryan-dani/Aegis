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

Run a release with an explicit version:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Version 0.1.8 -Notes "Describe the change"
```

Or auto-bump the patch version from `package.json`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Notes "Describe the change"
```

## Continuous Integration

Pushes to `main` and pull requests trigger GitHub Actions (`.github/workflows/ci.yml`) to:

1. Install dependencies.
2. Build the frontend (`pnpm build`).
3. Run Rust tests (`cargo test`).

CI validates changes only. It does not bump versions, commit, tag, or publish releases.

## Publishing Releases

Releases are intentional. Use one of these paths when you are ready to ship:

### GitHub Actions (recommended)

1. Open **Actions → Release → Run workflow** on `main`.
2. Optionally add release notes.
3. The workflow auto-increments the patch version, builds and signs the Windows installer, commits `release: vX.Y.Z`, tags, pushes, and publishes GitHub Release assets including `latest.json`.

Required repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — contents of `%USERPROFILE%\.aegis\aegis-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — optional; only if the key is password-protected

### Local release script

Run `scripts\release.ps1` from your machine when you have signing keys configured locally (see examples above).

After a release workflow completes, run `git pull --ff-only` locally to sync the version-bump commit pushed by CI.

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
