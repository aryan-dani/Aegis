# Aegis User Guide

This guide explains the normal operating flow for Aegis: creating a vault, storing entries, using Windows Hello, backing up data, and installing updates.

## What Aegis Is

Aegis is a desktop password manager. It stores an encrypted vault on your computer and unlocks it with a master password. It does not require an online account, cloud sync, or a hosted backend.

## Create a Vault

1. Open Aegis.
2. Enter a master password with at least 12 characters.
3. Confirm the master password.
4. Select **Create encrypted vault**.

The master password is not stored. Aegis uses it to derive encryption keys locally.

## Unlock a Vault

Open Aegis and enter the master password. If Windows Hello has been enabled for the vault, you can also use **Unlock with Windows Hello**.

The master password remains the recovery path. If Windows Hello stops working, unlock with the master password and re-enable Windows Hello from settings.

## Add an Entry

1. Unlock the vault.
2. Select **Add entry**.
3. Fill in the title, username, password, URL, folder, tags, and notes as needed.
4. Select **Save encrypted entry**.

Entries are encrypted before they are persisted.

## Search and Organize

Use the search field to filter entries by title, username, URL, folder, tags, and notes. Use folders and tags for lightweight organization without requiring a strict hierarchy.

## Copy Secrets

When you copy a password or secret, Aegis writes it to the system clipboard and clears it automatically after the configured delay. Avoid pasting secrets into untrusted applications.

## Windows Hello

Windows Hello can be enabled from **Settings**. It uses the Windows platform authenticator for the prompt and Windows DPAPI for key protection.

Use Windows Hello for convenience, not as a replacement for the master password.

## Breach Checks

HIBP breach checks are optional. When enabled, Aegis sends only the first five SHA-1 characters of the password hash to the Have I Been Pwned k-anonymity API. The full password is never sent.

Leave breach checks disabled if you want a fully offline workflow.

## Backups

Use **Settings** to export an encrypted backup. Choose a strong backup passphrase that is different from the master password.

Store backups somewhere separate from the main device. A backup is only useful if you can remember the backup passphrase.

## Updates

After installing a version that includes the updater, future releases can be installed from inside Aegis:

1. Unlock the vault.
2. Open **Settings**.
3. Select **Check for updates**.
4. Install the update if one is available.

Updates are downloaded from GitHub Releases and verified with the Tauri updater signature before installation.
