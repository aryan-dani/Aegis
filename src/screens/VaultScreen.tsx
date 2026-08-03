import { useEffect, useMemo, useState, type ReactNode } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Clock,
  Database,
  Download,
  FilePlus2,
  FileText,
  Fingerprint,
  Folder,
  FolderOpen,
  Import,
  KeyRound,
  LayoutGrid,
  Lock,
  Plus,
  Settings,
  Shield,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { AegisLogo } from "@/components/AegisLogo";
import { DocumentDialog } from "@/components/DocumentDialog";
import { EntryDialog } from "@/components/EntryDialog";
import { EntryRow } from "@/components/EntryRow";
import { FilterButton } from "@/components/FilterButton";
import { SearchBar } from "@/components/SearchBar";
import { UpdatePanel } from "@/components/UpdatePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/ipc";
import { entryLabel } from "@/lib/format";
import { clearWindowsHelloCredential, enrollWindowsHello } from "@/lib/windowsHello";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import {
  filterEntries,
  isDocument,
  isPassword,
  useVaultStore,
} from "@/store/vaultStore";
import type { BiometricStatus, DocumentMetaInput, EntryInput, VaultEntry } from "@/types";

type NavView = "all" | "passwords" | "documents" | "settings";

const PERSONAL_DOCUMENTS =
  "C:\\Users\\dania\\Documents\\Stuff\\Personal_Documents";

export function VaultScreen() {
  const { lock } = useAuthStore();
  const {
    entries,
    folders,
    tags,
    loaded,
    loading,
    error,
    load,
    add,
    update,
    updateDocument,
    importDocument,
    importDocumentsFromFolder,
    remove,
  } = useVaultStore();
  const { hibpEnabled, setHibpEnabled, inactivitySeconds, setInactivitySeconds } = useUiStore();

  const [view, setView] = useState<NavView>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<VaultEntry | null>(null);
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

  useEffect(() => {
    load();
    api.setInactivityTimeout(inactivitySeconds).catch((cause) => {
      toast.error("Could not apply auto-lock timeout", { description: String(cause) });
    });
    refreshBiometric().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const passwordCount = useMemo(() => entries.filter(isPassword).length, [entries]);
  const documentCount = useMemo(() => entries.filter(isDocument).length, [entries]);

  const kindFilter =
    view === "passwords" ? "password" : view === "documents" ? "document" : "all";

  const visibleEntries = useMemo(
    () => filterEntries(entries, query, folderFilter, tagFilter, kindFilter),
    [entries, query, folderFilter, tagFilter, kindFilter],
  );

  async function onSaveEntry(input: EntryInput) {
    if (editing && isPassword(editing)) {
      await update(editing.id, input);
    } else {
      await add(input);
    }
    setEditing(null);
  }

  async function onSaveDocument(id: string, input: DocumentMetaInput) {
    await updateDocument(id, input);
    setActiveDocument((current) =>
      current && current.id === id ? { ...current, ...input, folder: input.folder ?? null } : current,
    );
  }

  async function onDelete(entry: VaultEntry) {
    await remove(entry.id);
    toast.success(isDocument(entry) ? "Document deleted" : "Credential deleted", {
      description: entryLabel(entry),
    });
  }

  function lockNow() {
    lock();
    useVaultStore.getState().wipe();
    toast.info("Vault locked", { description: "The key was wiped from memory." });
  }

  function openItem(entry: VaultEntry) {
    if (isDocument(entry)) {
      setActiveDocument(entry);
      setDocumentOpen(true);
      return;
    }
    setEditing(entry);
    setDialogOpen(true);
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
      toast.success(`Imported ${imported.length} items`);
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
      toast.success(`Imported ${imported.length} credentials from CSV`);
    } catch (cause) {
      toast.error("CSV import failed", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function importDocuments() {
    setImporting(true);
    try {
      const paths = await open({
        multiple: true,
        filters: [
          {
            name: "Documents",
            extensions: ["jpg", "jpeg", "png", "gif", "webp", "pdf", "txt", "md", "doc", "docx"],
          },
        ],
      });
      if (!paths) return;
      const list = Array.isArray(paths) ? paths : [paths];
      let count = 0;
      for (const path of list) {
        await importDocument(path, "Personal Documents", ["imported"]);
        count += 1;
      }
      toast.success(`Encrypted ${count} document${count === 1 ? "" : "s"} into the vault`);
      setView("documents");
    } catch (cause) {
      toast.error("Document import failed", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function importPersonalFolder() {
    setImporting(true);
    try {
      const imported = await importDocumentsFromFolder(
        PERSONAL_DOCUMENTS,
        "Personal Documents",
      );
      if (!imported.length) {
        toast.info("No importable files found in Personal Documents");
        return;
      }
      toast.success(`Encrypted ${imported.length} personal documents into Aegis`);
      setView("documents");
    } catch (cause) {
      toast.error("Could not import Personal Documents", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function importFolderPicker() {
    setImporting(true);
    try {
      const path = await open({ directory: true, multiple: false });
      if (typeof path !== "string") return;
      const imported = await importDocumentsFromFolder(path, "Imported Documents");
      toast.success(`Encrypted ${imported.length} documents into the vault`);
      setView("documents");
    } catch (cause) {
      toast.error("Folder import failed", { description: String(cause) });
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
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      await enrollWindowsHello();
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
      clearWindowsHelloCredential();
      await refreshBiometric();
      toast.success("Windows Hello disabled");
    } catch (cause) {
      toast.error("Could not disable Windows Hello", { description: String(cause) });
    } finally {
      setHelloBusy(false);
    }
  }

  const hasFilters = Boolean(query || folderFilter || tagFilter);
  const heading =
    view === "passwords"
      ? "Passwords"
      : view === "documents"
        ? "Documents"
        : view === "settings"
          ? "Settings"
          : "Vault";

  return (
    <main className="aegis-app-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-5 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="aegis-panel hidden w-[248px] shrink-0 flex-col rounded-[28px] p-4 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-2 pt-1">
            <AegisLogo size="sm" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Local vault
              </p>
              <h1 className="text-base font-semibold tracking-tight">Aegis</h1>
            </div>
          </div>

          <nav className="space-y-1">
            <NavButton
              active={view === "all"}
              icon={<LayoutGrid className="size-4" />}
              label="All items"
              count={entries.length}
              onClick={() => setView("all")}
            />
            <NavButton
              active={view === "passwords"}
              icon={<KeyRound className="size-4" />}
              label="Passwords"
              count={passwordCount}
              onClick={() => setView("passwords")}
            />
            <NavButton
              active={view === "documents"}
              icon={<FileText className="size-4" />}
              label="Documents"
              count={documentCount}
              onClick={() => setView("documents")}
            />
            <NavButton
              active={view === "settings"}
              icon={<Settings className="size-4" />}
              label="Settings"
              onClick={() => {
                setView("settings");
                refreshBiometric().catch(() => undefined);
              }}
            />
          </nav>

          <div className="mt-8 flex-1 overflow-hidden">
            <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Folder className="size-3.5" />
              Folders
            </p>
            <div className="space-y-1">
              <FilterButton
                active={!folderFilter}
                count={
                  kindFilter === "all"
                    ? entries.length
                    : kindFilter === "password"
                      ? passwordCount
                      : documentCount
                }
                label="All folders"
                onClick={() => setFolderFilter(null)}
              />
              {folders.map((folder) => (
                <FilterButton
                  active={folderFilter === folder}
                  count={
                    entries.filter(
                      (entry) =>
                        entry.folder === folder &&
                        (kindFilter === "all" ||
                          (kindFilter === "password" ? isPassword(entry) : isDocument(entry))),
                    ).length
                  }
                  key={folder}
                  label={folder}
                  onClick={() => setFolderFilter(folderFilter === folder ? null : folder)}
                />
              ))}
            </div>

            {tags.length ? (
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
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

          <Button className="mt-4 w-full" variant="outline" onClick={lockNow}>
            <Lock className="size-4" />
            Lock vault
          </Button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="aegis-glass flex flex-wrap items-center justify-between gap-3 rounded-[28px] px-5 py-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Secure local storage
              </p>
              <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
              <p className="text-xs text-muted-foreground">
                {passwordCount} credentials · {documentCount} documents · encrypted at rest
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-2xl border bg-background/40 p-1 lg:hidden">
                {(
                  [
                    ["all", "All"],
                    ["passwords", "Passwords"],
                    ["documents", "Docs"],
                    ["settings", "Settings"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={view === id ? "default" : "ghost"}
                    onClick={() => setView(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {view !== "settings" ? (
                <>
                  {view !== "passwords" ? (
                    <Button disabled={importing} variant="secondary" onClick={importDocuments}>
                      {importing ? <Spinner /> : <FilePlus2 className="size-4" />}
                      Add documents
                    </Button>
                  ) : null}
                  {view !== "documents" ? (
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="size-4" />
                      Add password
                    </Button>
                  ) : (
                    <Button disabled={importing} onClick={importPersonalFolder}>
                      {importing ? <Spinner /> : <FolderOpen className="size-4" />}
                      Import Personal Documents
                    </Button>
                  )}
                </>
              ) : null}
              <Button className="lg:hidden" variant="outline" onClick={lockNow}>
                <Lock className="size-4" />
              </Button>
            </div>
          </header>

          {view === "settings" ? (
            <SettingsPanel
              biometric={biometric}
              helloAvailable={helloAvailable}
              helloBusy={helloBusy}
              hibpEnabled={hibpEnabled}
              setHibpEnabled={setHibpEnabled}
              inactivitySeconds={inactivitySeconds}
              setInactivitySeconds={setInactivitySeconds}
              updateTimeout={updateTimeout}
              enrollBiometric={enrollBiometric}
              disableBiometric={disableBiometric}
              exportPassphrase={exportPassphrase}
              setExportPassphrase={setExportPassphrase}
              backupPassphrase={backupPassphrase}
              setBackupPassphrase={setBackupPassphrase}
              exporting={exporting}
              importing={importing}
              exportBackup={exportBackup}
              importBackup={importBackup}
              importBitwarden={importBitwarden}
              importFolderPicker={importFolderPicker}
              importPersonalFolder={importPersonalFolder}
            />
          ) : (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder={
                      view === "documents"
                        ? "Search documents by title, filename, or tag"
                        : view === "passwords"
                          ? "Search passwords by site, username, or tag"
                          : "Search passwords and documents"
                    }
                  />
                </div>
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
                <ScrollArea className="-mr-3 h-[calc(100vh-210px)] pr-3">
                  <div className="space-y-2.5">
                    {visibleEntries.map((entry, index) => (
                      <EntryRow
                        entry={entry}
                        index={index}
                        key={entry.id}
                        onDelete={() => onDelete(entry)}
                        onOpen={() => openItem(entry)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState
                  hasFilters={hasFilters}
                  view={view === "documents" ? "documents" : view === "passwords" ? "passwords" : "all"}
                  onAddPassword={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  onAddDocuments={importDocuments}
                  onImportPersonal={importPersonalFolder}
                />
              )}
            </>
          )}
        </section>
      </div>

      <EntryDialog
        entry={editing && isPassword(editing) ? editing : null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={onSaveEntry}
      />
      <DocumentDialog
        entry={activeDocument}
        open={documentOpen}
        onOpenChange={setDocumentOpen}
        onSave={onSaveDocument}
      />
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      {typeof count === "number" ? (
        <span className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function EmptyState({
  hasFilters,
  view,
  onAddPassword,
  onAddDocuments,
  onImportPersonal,
}: {
  hasFilters: boolean;
  view: "all" | "passwords" | "documents";
  onAddPassword: () => void;
  onAddDocuments: () => void;
  onImportPersonal: () => void;
}) {
  const title = hasFilters
    ? "No matching items"
    : view === "documents"
      ? "No documents yet"
      : view === "passwords"
        ? "No passwords yet"
        : "Your vault is empty";
  const body = hasFilters
    ? "Try a different search or clear your filters."
    : view === "documents"
      ? "Import identity scans and files. Aegis encrypts each file before it touches vault storage."
      : "Add credentials and documents. Everything is encrypted with your master key before storage.";

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed py-20 text-center animate-in fade-in-0 zoom-in-95 duration-300">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card text-muted-foreground">
        {view === "documents" ? <FileText className="size-6" /> : <Shield className="size-6" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {!hasFilters ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {view !== "documents" ? (
            <Button onClick={onAddPassword}>
              <Plus className="size-4" />
              Add password
            </Button>
          ) : null}
          {view !== "passwords" ? (
            <>
              <Button variant="secondary" onClick={onAddDocuments}>
                <FilePlus2 className="size-4" />
                Add documents
              </Button>
              {view === "documents" || view === "all" ? (
                <Button variant="outline" onClick={onImportPersonal}>
                  <FolderOpen className="size-4" />
                  Import Personal Documents
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingsPanel(props: {
  biometric: BiometricStatus | null;
  helloAvailable: boolean;
  helloBusy: boolean;
  hibpEnabled: boolean;
  setHibpEnabled: (value: boolean) => void;
  inactivitySeconds: number;
  setInactivitySeconds: (value: number) => void;
  updateTimeout: (seconds: number) => Promise<void>;
  enrollBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  exportPassphrase: string;
  setExportPassphrase: (value: string) => void;
  backupPassphrase: string;
  setBackupPassphrase: (value: string) => void;
  exporting: boolean;
  importing: boolean;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  importBitwarden: () => Promise<void>;
  importFolderPicker: () => Promise<void>;
  importPersonalFolder: () => Promise<void>;
}) {
  return (
    <div className="aegis-panel overflow-hidden rounded-[28px] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="border-b bg-background/35 px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Control center
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Security and maintenance</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Manage vault posture, documents, signed updates, Windows Hello, auto-lock, and encrypted
          backups from one workspace.
        </p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-6">
          <UpdatePanel />

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <AegisLogo className="shrink-0" size="sm" />
              <div>
                <Label>Vault posture</Label>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Passwords and documents are encrypted locally with AES-256-GCM before storage.
                  Document binaries live in encrypted blob files beside the SQLCipher database.
                  Aegis does not sync vault content or send telemetry.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Storage</p>
                <p className="mt-1 text-sm font-medium">SQLCipher + encrypted blobs</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Encryption</p>
                <p className="mt-1 text-sm font-medium">AES-256-GCM</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Network</p>
                <p className="mt-1 text-sm font-medium">Manual and opt-in</p>
              </div>
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                  <Database className="size-5" />
                </div>
                <div>
                  <Label>HIBP breach checks</Label>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Optional online check. Aegis sends only the first five SHA-1 characters of the
                    password hash; the full password never leaves the device.
                  </p>
                </div>
              </div>
              <Switch checked={props.hibpEnabled} onCheckedChange={props.setHibpEnabled} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                <Clock className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="timeout">Auto-lock timeout</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Lock the vault after inactivity. Shorter values reduce exposure on shared machines.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Input
                    className="max-w-40"
                    id="timeout"
                    min={30}
                    type="number"
                    value={props.inactivitySeconds}
                    onBlur={(event) => props.updateTimeout(Number(event.target.value))}
                    onChange={(event) => props.setInactivitySeconds(Number(event.target.value))}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                <Fingerprint className="size-5" />
              </div>
              <div>
                <Label>Windows Hello unlock</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Convenience unlock for this Windows profile. The vault key is protected with
                  Windows DPAPI after an operating-system verification.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Current status</p>
              <p className="mt-1 text-sm font-medium">
                {props.helloAvailable
                  ? props.biometric?.enrolled
                    ? "Enabled for this vault"
                    : "Available, not yet enabled"
                  : "Not available in this window"}
              </p>
            </div>
            <div className="mt-4">
              {props.biometric?.enrolled ? (
                <Button
                  className="w-full"
                  disabled={props.helloBusy}
                  variant="destructive"
                  onClick={props.disableBiometric}
                >
                  {props.helloBusy ? <Spinner /> : null}
                  Disable Windows Hello
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={!props.helloAvailable || props.helloBusy}
                  onClick={props.enrollBiometric}
                >
                  {props.helloBusy ? <Spinner /> : <Fingerprint className="size-4" />}
                  Enable Windows Hello
                </Button>
              )}
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div>
              <Label>Data portability</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Export encrypted backups for passwords and documents, restore backups, migrate
                Bitwarden CSV, or import document folders.
              </p>
            </div>

            <Tabs defaultValue="export" className="mt-5">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="export">Export</TabsTrigger>
                <TabsTrigger value="backup">Restore</TabsTrigger>
                <TabsTrigger value="csv">CSV</TabsTrigger>
                <TabsTrigger value="docs">Docs</TabsTrigger>
              </TabsList>
              <TabsContent value="export" className="space-y-3 pt-4">
                <Input
                  type="password"
                  value={props.exportPassphrase}
                  onChange={(event) => props.setExportPassphrase(event.target.value)}
                  placeholder="Export passphrase (min 12 chars)"
                />
                <Button
                  className="w-full"
                  disabled={props.exportPassphrase.length < 12 || props.exporting}
                  onClick={props.exportBackup}
                >
                  {props.exporting ? <Spinner /> : <Download className="size-4" />}
                  Export encrypted backup
                </Button>
              </TabsContent>
              <TabsContent value="backup" className="space-y-3 pt-4">
                <Input
                  type="password"
                  value={props.backupPassphrase}
                  onChange={(event) => props.setBackupPassphrase(event.target.value)}
                  placeholder="Backup passphrase"
                />
                <Button
                  className="w-full"
                  disabled={props.backupPassphrase.length < 12 || props.importing}
                  onClick={props.importBackup}
                >
                  {props.importing ? <Spinner /> : <Import className="size-4" />}
                  Restore from backup
                </Button>
              </TabsContent>
              <TabsContent value="csv" className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  disabled={props.importing}
                  variant="secondary"
                  onClick={props.importBitwarden}
                >
                  {props.importing ? <Spinner /> : <Import className="size-4" />}
                  Import Bitwarden CSV
                </Button>
              </TabsContent>
              <TabsContent value="docs" className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  disabled={props.importing}
                  onClick={props.importPersonalFolder}
                >
                  {props.importing ? <Spinner /> : <FolderOpen className="size-4" />}
                  Import Personal Documents
                </Button>
                <Button
                  className="w-full"
                  disabled={props.importing}
                  variant="secondary"
                  onClick={props.importFolderPicker}
                >
                  {props.importing ? <Spinner /> : <Folder className="size-4" />}
                  Choose folder to import
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
