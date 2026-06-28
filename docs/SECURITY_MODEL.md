# Aegis Security Model

This document describes the security assumptions and boundaries of Aegis.

## Goals

Aegis is designed to protect password manager data at rest on a local machine. It prioritizes local encryption, minimal network exposure, and clear recovery behavior over cloud sync or account-based convenience.

## Non-Goals

Aegis does not protect against every form of local compromise. If malware, a keylogger, or a remote administration tool is already running with sufficient privileges, it may observe user input, clipboard contents, memory, screenshots, or files as they are used.

Aegis does not provide cloud recovery. If the master password and backup passphrases are lost, the vault cannot be recovered.

## Vault Encryption

Aegis uses a layered local encryption model:

- Argon2id derives key material from the master password.
- Entry data is encrypted with AES-256-GCM.
- The SQLite database is protected with SQLCipher.
- In-memory key material is handled in Rust and wiped where practical.

This means the database file is not intended to be readable without the vault key.

## Master Password Handling

The master password is not stored. It is used to derive the vault key during vault creation and unlock.

Failed unlock attempts are tracked so repeated guessing can be slowed down locally. This is not a substitute for choosing a strong master password.

## Windows Hello

Windows Hello support is a convenience unlock path. Enrollment requires an unlocked vault. Aegis prompts through the frontend platform authenticator flow and protects the vault key with Windows DPAPI.

Important boundaries:

- Windows Hello does not replace the master password.
- The feature is tied to the local Windows profile and device state.
- Hardware, account, or Windows Hello changes may require re-enrollment.

## Clipboard Handling

Aegis can copy secrets to the system clipboard and clear them after a delay. Clipboard data may still be visible to other local software while it is present.

Use clipboard copy only in trusted desktop sessions.

## Network Access

Aegis is local-first. Network access is intentionally narrow:

- The updater fetches release metadata and signed installers from GitHub Releases.
- Optional breach checks query the HIBP k-anonymity endpoint using only the first five SHA-1 hash characters.

No vault content is sent by the updater.

## Updates

Updater artifacts are signed. The application verifies the update signature before installing.

The public updater metadata endpoint must remain accessible without authentication. Do not use a private GitHub repository for release assets unless a separate authenticated update distribution system is implemented.

## Backup Security

Encrypted backups are protected by the export passphrase. Treat exported backup files as sensitive.

Recommended practice:

- Use a backup passphrase that is long and unique.
- Store backups away from the primary device.
- Test restore behavior before relying on a backup process.
