export function ArchitectureDiagram() {
  return (
    <main className="aegis-app-bg flex min-h-screen items-center justify-center px-8 py-10">
      <div className="aegis-panel w-full max-w-4xl rounded-[28px] p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Architecture
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Local-first by design</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          React handles the workspace UI. Tauri IPC bridges to Rust, where secrets are encrypted
          before any database or blob write.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border bg-background/60 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Frontend
            </p>
            <h2 className="mt-2 text-lg font-semibold">React + TypeScript</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Vault workspace UI</li>
              <li>WebAuthn Windows Hello</li>
              <li>Zustand state</li>
            </ul>
          </section>

          <section className="rounded-2xl border bg-background/60 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Bridge
            </p>
            <h2 className="mt-2 text-lg font-semibold">Tauri IPC</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Typed invoke commands</li>
              <li>Native dialogs + FS</li>
              <li>Signed updater plugin</li>
            </ul>
          </section>

          <section className="rounded-2xl border bg-background/60 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Backend
            </p>
            <h2 className="mt-2 text-lg font-semibold">Rust + SQLCipher</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Argon2id key derivation</li>
              <li>AES-256-GCM entry crypto</li>
              <li>Encrypted document blobs</li>
            </ul>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">React UI</span>
          <span>→</span>
          <span className="rounded-full border px-3 py-1">Tauri IPC</span>
          <span>→</span>
          <span className="rounded-full border px-3 py-1">Rust crypto</span>
          <span>→</span>
          <span className="rounded-full border px-3 py-1">SQLCipher + blobs</span>
        </div>
      </div>
    </main>
  );
}
