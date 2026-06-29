import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowLeft,
  Clock,
  Database,
  Download,
  Fingerprint,
  Folder,
  Import,
  KeyRound,
  Lock,
  Plus,
  Settings,
  Shield,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntryDialog } from "@/components/EntryDialog";
import { EntryRow } from "@/components/EntryRow";
import { FilterButton } from "@/components/FilterButton";
import { SearchBar } from "@/components/SearchBar";
import { UpdatePanel } from "@/components/UpdatePanel";
import { api } from "@/lib/ipc";
import { entryLabel } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { filterEntries, useVaultStore } from "@/store/vaultStore";
import type { BiometricStatus, EntryInput, VaultEntry } from "@/types";

export function VaultScreen() {
  const { lock } = useAuthStore();
  const { entries, folders, tags, loaded, loading, error, load, add, update, remove } =
    useVaultStore();
  const { hibpEnabled, setHibpEnabled, inactivitySeconds, setInactivitySeconds } = useUiStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);
  const [helloAvailable, setHelloAvailable] = useState(false);
  const [helloBusy, setHelloBusy] = useState(false);
  const [view, setView] = useState<"vault" | "settings">("vault");

  useEffect(() => {
    load();
    api.setInactivityTimeout(inactivitySeconds).catch((cause) => {
      toast.error("Could not apply auto-lock timeout", { description: String(cause) });
    });
    refreshBiometric().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const visibleEntries = useMemo(
    () => filterEntries(entries, query, folderFilter, tagFilter),
    [entries, query, folderFilter, tagFilter],
  );

  async function onSaveEntry(input: EntryInput) {
    if (editing) {
      await update(editing.id, input);
    } else {
      await add(input);
    }
    setEditing(null);
  }

  async function onDelete(entry: VaultEntry) {
    await remove(entry.id);
    toast.success("Entry deleted", { description: entryLabel(entry) });
  }

  function lockNow() {
    lock();
    useVaultStore.getState().wipe();
    toast.info("Vault locked", { description: "The key was wiped from memory." });
  }

  async function exportBackup() {
    if (exportPassphrase.length < 12) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: "aegis-backup.json",
        filters: [{ name: "Aegis encrypted backup", extensions: ["json"] }],
      });
      if (!path) return;
      await api.exportVault(exportPassphrase, path);
      setExportPassphrase("");
      toast.success("Encrypted backup exported");
    } catch (cause) {
      toast.error("Export failed", { description: String(cause) });
    } finally {
      setExporting(false);
    }
  }

  async function importBackup() {
    if (backupPassphrase.length < 12) return;
    setImporting(true);
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Aegis encrypted backup", extensions: ["json"] }],
      });
      if (typeof path !== "string") return;
      const imported = await api.importEncryptedBackup(backupPassphrase, path);
      setBackupPassphrase("");
      await load();
      toast.success(`Imported ${imported.length} entries`);
    } catch (cause) {
      toast.error("Import failed", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function importBitwarden() {
    setImporting(true);
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Bitwarden CSV", extensions: ["csv"] }],
      });
      if (typeof path !== "string") return;
      const imported = await api.importBitwardenCsv(path);
      await load();
      toast.success(`Imported ${imported.length} entries from CSV`);
    } catch (cause) {
      toast.error("CSV import failed", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function updateTimeout(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 30) {
      toast.error("Auto-lock timeout must be at least 30 seconds");
      return;
    }
    setInactivitySeconds(seconds);
    try {
      await api.setInactivityTimeout(seconds);
    } catch (cause) {
      toast.error("Could not apply auto-lock timeout", { description: String(cause) });
    }
  }

  async function refreshBiometric() {
    const result = await api.biometricStatus();
    setBiometric(result);
    setHelloAvailable(result.available);
  }

  async function enrollBiometric() {
    setHelloBusy(true);
    try {
      const win = getCurrentWindow();
      await win.unminimize();
      await win.show();
      await win.setFocus();
      await api.enrollBiometric();
      await refreshBiometric();
      toast.success("Windows Hello enabled");
    } catch (cause) {
      toast.error("Windows Hello enrollment failed", { description: String(cause) });
    } finally {
      setHelloBusy(false);
    }
  }

  async function disableBiometric() {
    setHelloBusy(true);
    try {
      await api.disableBiometric();
      await refreshBiometric();
      toast.success("Windows Hello disabled");
    } catch (cause) {
      toast.error("Could not disable Windows Hello", { description: String(cause) });
    } finally {
      setHelloBusy(false);
    }
  }

  const hasFilters = Boolean(query || folderFilter || tagFilter);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-5 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border bg-background text-foreground">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">Aegis</h1>
              <p className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "credential" : "credentials"} · local-only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "settings" ? (
              <Button onClick={() => setView("vault")} variant="secondary">
                <ArrowLeft className="size-4" />
                Back to vault
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setView("settings");
                  refreshBiometric().catch(() => undefined);
                }}
                variant="secondary"
              >
                <Settings className="size-4" />
                Settings
              </Button>
            )}
            <Button onClick={lockNow} title="Lock (Ctrl+Shift+L)" variant="outline">
              <Lock className="size-4" />
              Lock
            </Button>
          </div>
        </header>

        {view === "settings" ? (
          <section className="flex flex-1 flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
              <div className="border-b bg-background/40 px-6 py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      Control center
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      Security and maintenance
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Manage vault posture, signed updates, Windows Hello, auto-lock behavior, and
                      encrypted data movement from one full-size workspace.
                    </p>
                  </div>
                  <Button onClick={() => setView("vault")} variant="outline">
                    <ArrowLeft className="size-4" />
                    Return to vault
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <div className="space-y-6">
                  <UpdatePanel />

                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                        <Shield className="size-5" />
                      </div>
                      <div>
                        <Label>Vault posture</Label>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          Entries are encrypted locally before storage. Aegis does not sync vault
                          content, collect analytics, or send telemetry.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Storage</p>
                        <p className="mt-1 text-sm font-medium">SQLCipher database</p>
                      </div>
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Entry encryption</p>
                        <p className="mt-1 text-sm font-medium">AES-256-GCM</p>
                      </div>
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Network posture</p>
                        <p className="mt-1 text-sm font-medium">Manual and opt-in</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex items-start gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                          <Database className="size-5" />
                        </div>
                        <div>
                          <Label>HIBP breach checks</Label>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            Optional online check. Aegis sends only the first five SHA-1 characters
                            of the password hash; the full password never leaves the device.
                          </p>
                        </div>
                      </div>
                      <Switch checked={hibpEnabled} onCheckedChange={setHibpEnabled} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                        <Clock className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Label htmlFor="timeout">Auto-lock timeout</Label>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          Lock the vault after inactivity. Shorter values reduce exposure on shared
                          or unattended machines.
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <Input
                            className="max-w-40"
                            id="timeout"
                            min={30}
                            type="number"
                            value={inactivitySeconds}
                            onBlur={(event) => updateTimeout(Number(event.target.value))}
                            onChange={(event) => setInactivitySeconds(Number(event.target.value))}
                          />
                          <span className="text-sm text-muted-foreground">seconds</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                        <Fingerprint className="size-5" />
                      </div>
                      <div>
                        <Label>Windows Hello unlock</Label>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          Convenience unlock for this Windows profile. The vault key is protected
                          with Windows DPAPI after an operating-system verification.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-xl border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Current status</p>
                      <p className="mt-1 text-sm font-medium">
                        {helloAvailable
                          ? biometric?.enrolled
                            ? "Enabled for this vault"
                            : "Available, not yet enabled"
                          : "Not available in this window"}
                      </p>
                    </div>
                    <div className="mt-4">
                      {biometric?.enrolled ? (
                        <Button
                          className="w-full"
                          disabled={helloBusy}
                          variant="destructive"
                          onClick={disableBiometric}
                        >
                          {helloBusy ? <Spinner /> : null}
                          Disable Windows Hello
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={!helloAvailable || helloBusy}
                          onClick={enrollBiometric}
                        >
                          {helloBusy ? <Spinner /> : <Fingerprint className="size-4" />}
                          Enable Windows Hello
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div>
                      <Label>Data portability</Label>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Export encrypted backups for recovery, restore encrypted backups, or migrate
                        from Bitwarden CSV. Treat exported files as sensitive.
                      </p>
                    </div>

                    <Tabs defaultValue="export" className="mt-5">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="export">Export</TabsTrigger>
                        <TabsTrigger value="backup">Restore</TabsTrigger>
                        <TabsTrigger value="csv">CSV</TabsTrigger>
                      </TabsList>
                      <TabsContent value="export" className="space-y-3 pt-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Creates an encrypted backup protected by the passphrase below.
                        </p>
                        <Input
                          type="password"
                          value={exportPassphrase}
                          onChange={(event) => setExportPassphrase(event.target.value)}
                          placeholder="Export passphrase (min 12 chars)"
                        />
                        <Button
                          className="w-full"
                          disabled={exportPassphrase.length < 12 || exporting}
                          onClick={exportBackup}
                        >
                          {exporting ? <Spinner /> : <Download className="size-4" />}
                          Export encrypted backup
                        </Button>
                      </TabsContent>
                      <TabsContent value="backup" className="space-y-3 pt-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Restores a previously exported encrypted backup.
                        </p>
                        <Input
                          type="password"
                          value={backupPassphrase}
                          onChange={(event) => setBackupPassphrase(event.target.value)}
                          placeholder="Backup passphrase"
                        />
                        <Button
                          className="w-full"
                          disabled={backupPassphrase.length < 12 || importing}
                          onClick={importBackup}
                        >
                          {importing ? <Spinner /> : <Import className="size-4" />}
                          Restore from backup
                        </Button>
                      </TabsContent>
                      <TabsContent value="csv" className="space-y-3 pt-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Imports a Bitwarden CSV and encrypts parsed entries locally in Rust.
                        </p>
                        <Button
                          className="w-full"
                          disabled={importing}
                          variant="secondary"
                          onClick={importBitwarden}
                        >
                          {importing ? <Spinner /> : <Import className="size-4" />}
                          Import Bitwarden CSV
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid flex-1 gap-6 lg:grid-cols-[248px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              <div>
                <p className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Folder className="size-3.5" />
                  Folders
                </p>
                <div className="space-y-1">
                  <FilterButton
                    active={!folderFilter}
                    count={entries.length}
                    label="All items"
                    onClick={() => setFolderFilter(null)}
                  />
                  {folders.map((folder) => (
                    <FilterButton
                      active={folderFilter === folder}
                      count={entries.filter((entry) => entry.folder === folder).length}
                      key={folder}
                      label={folder}
                      onClick={() => setFolderFilter(folderFilter === folder ? null : folder)}
                    />
                  ))}
                  {!folders.length ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet</p>
                  ) : null}
                </div>
              </div>

              {tags.length ? (
                <div>
                  <p className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Tag className="size-3.5" />
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {tags.map((tag) => (
                      <Badge
                        className="cursor-pointer transition-transform active:scale-95"
                        key={tag}
                        variant={tagFilter === tag ? "default" : "secondary"}
                        onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <SearchBar value={query} onChange={setQuery} />
              </div>
              <Button
                className="h-10"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add entry
              </Button>
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {loading && !loaded ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-[72px] w-full rounded-xl" />
                ))}
              </div>
            ) : visibleEntries.length ? (
              <ScrollArea className="-mr-3 h-[calc(100vh-220px)] pr-3">
                <div className="space-y-2.5">
                  {visibleEntries.map((entry, index) => (
                    <EntryRow
                      entry={entry}
                      index={index}
                      key={entry.id}
                      onDelete={() => onDelete(entry)}
                      onEdit={() => {
                        setEditing(entry);
                        setDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState hasFilters={hasFilters} onAdd={() => setDialogOpen(true)} />
            )}
          </section>
          </div>
        )}
      </div>

      <EntryDialog
        entry={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={onSaveEntry}
      />
    </main>
  );
}

function EmptyState({ hasFilters, onAdd }: { hasFilters: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center animate-in fade-in-0 zoom-in-95 duration-300">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card text-muted-foreground">
        <KeyRound className="size-6" />
      </div>
      <p className="text-sm font-medium">
        {hasFilters ? "No matching entries" : "Your vault is empty"}
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {hasFilters
          ? "Try a different search or clear your filters."
          : "Add your first credential. It is encrypted before it ever touches disk."}
      </p>
      {!hasFilters ? (
        <Button className="mt-5" onClick={onAdd}>
          <Plus className="size-4" />
          Add entry
        </Button>
      ) : null}
    </div>
  );
}
