# Aegis — LinkedIn Post Draft

**Repo:** https://github.com/aryan-dani/Aegis  
**Version referenced:** v0.1.14  
**Tone:** Builder story  
**Suggested format:** Carousel (6 screenshots) + post text below

---

## Primary post (copy/paste)

I built Aegis — a local-first password vault for Windows.

No cloud sync. No account. No telemetry. Your master password never leaves your machine.

The stack: Tauri 2, Rust, React, SQLCipher, Argon2id, AES-256-GCM.

What I wanted:
→ Passwords and encrypted documents in one vault
→ Breach checks (HIBP) only when I opt in — k-anonymity, nothing stored
→ Windows Hello for daily unlock, master password as the real recovery path
→ Signed updates from GitHub Releases — no surprise auto-downloads

What broke along the way:
The first Windows Hello integration called UserConsentVerifier from Rust on a Tauri command thread. The app hung — "Not Responding." The fix was to keep interactive auth in the WebView (WebAuthn) and let Rust only wrap/unwrap the vault key with DPAPI.

Today Aegis handles credentials, document blobs, Bitwarden import, encrypted backups, auto-lock, and in-app signed updates.

It's early (v0.1.x) — a focused tool I use and iterate on, not a Bitwarden competitor.

If you care about local-first security or Tauri/Rust desktop apps, I'd love your eyes on it.

🔗 github.com/aryan-dani/Aegis

#BuildInPublic #Rust #Tauri #CyberSecurity #LocalFirst

---

## Short version (~400 chars)

Built Aegis — a local-first Windows password vault with Tauri, Rust, and SQLCipher. No cloud, no telemetry. Entries encrypted in Rust before disk. Windows Hello via WebAuthn (not a Rust COM call that froze the UI). Early v0.1.x, open for feedback: github.com/aryan-dani/Aegis

---

## Alt hooks (pick one to lead with)

**Hook A — problem first:**  
Every password manager I tried wanted the cloud. I wanted a vault that lives on my machine, with no account recovery theater. So I built Aegis.

**Hook B — technical lesson first:**  
Lesson learned building Windows Hello in a Tauri app: never call UserConsentVerifier from a Rust command thread. WebAuthn in the WebView + DPAPI in Rust — that's what finally worked.

---

## Carousel screenshot order + captions

| # | File | Caption (one line for LinkedIn) |
|---|------|----------------------------------|
| 1 | `screenshots/01-create-vault.png` | Create your vault — local encryption, no account recovery |
| 2 | `screenshots/02-vault-overview.png` | Passwords and encrypted documents in one workspace |
| 3 | `screenshots/03-entry-dialog.png` | Encrypted in Rust before anything hits disk |
| 4 | `screenshots/04-documents.png` | PDFs and images stored as encrypted blobs |
| 5 | `screenshots/05-settings-security.png` | Windows Hello, auto-lock, and signed updates |
| 6 | `screenshots/06-architecture.png` | React UI → Tauri IPC → Rust crypto + SQLCipher |

---

## Hashtags

**Primary:** `#BuildInPublic` `#Rust` `#Tauri` `#CyberSecurity` `#LocalFirst`

**Optional:** `#PasswordManager` `#DesktopApp` `#OpenSource` `#WindowsDev` `#InfoSec`

---

## Posting tips

- Upload screenshots as a **document/carousel** for better reach than a single image.
- Put the GitHub link in the **first comment** if you want cleaner post analytics, or keep it inline as above.
- First comment idea: "Stack details + security model doc: [link to SECURITY_MODEL.md on GitHub]"

## Regenerating screenshots

Screenshots live in `docs/marketing/screenshots/` and are captured from real UI components via the marketing preview:

```powershell
pnpm marketing:capture
```

This starts a Vite marketing preview (stubbed IPC + demo data) and captures all six PNGs with Playwright.
