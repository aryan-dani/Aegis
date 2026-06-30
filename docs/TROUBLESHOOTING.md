# Troubleshooting

This document covers common Aegis setup, update, and unlock problems.

## The Update Check Says It Cannot Fetch Valid JSON

Most likely causes:

- The GitHub repository is private.
- `latest.json` was uploaded with invalid encoding.
- The release does not include a `latest.json` asset.
- The app is pointing at the wrong GitHub owner or repository.

Check the update endpoint in a browser:

```text
https://github.com/aryan-dani/Aegis/releases/latest/download/latest.json
```

It should return JSON with `version`, `pub_date`, and `platforms`.

## The Update Button Is Missing

The update button exists only in builds that include the updater UI. Install the first updater-enabled build manually once, then use in-app updates for later versions.

Open the app, unlock the vault, and go to **Settings**. The section is named **Software updates**.

## Windows Hello Does Not Appear

Try these steps:

1. Make sure Windows Hello is configured in Windows settings.
2. Unlock Aegis with the master password.
3. Open **Settings**.
4. Disable and re-enable Windows Hello for the vault.
5. Close and reopen Aegis.

If Windows Hello still fails, continue using the master password. The master password is the recovery path.

## The App Opens a Console Window

Install the latest release build. The Windows GUI subsystem is configured so release builds launch as a desktop app without a console window.

## GitHub CLI Is Not Found

Install GitHub CLI:

```powershell
winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements
```

If the current terminal still cannot find `gh`, open a new terminal or run the scripts through the full path:

```text
C:\Program Files\GitHub CLI\gh.exe
```

## Build Fails With OpenSSL or SQLCipher Errors

Confirm the expected environment:

```powershell
$env:VCPKG_ROOT = "$env:USERPROFILE\vcpkg"
$env:OPENSSL_NO_VENDOR = "1"
$env:OPENSSL_DIR = "$env:USERPROFILE\vcpkg\installed\x64-windows-static"
$env:OPENSSL_STATIC = "1"
$env:RUSTFLAGS = "-Ctarget-feature=+crt-static"
```

Then rerun:

```powershell
pnpm tauri build
```

## Lost Master Password

Aegis cannot recover a lost master password. Restore from an encrypted backup if you have one and know its backup passphrase.
