import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FilePlus2, FileText, Folder, FolderOpen, Plus, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { DocumentDialog } from "@/components/DocumentDialog";
import { EntryDialog } from "@/components/EntryDialog";
import { EntryRow } from "@/components/EntryRow";
import { SearchBar } from "@/components/SearchBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { VaultSidebar, type VaultNavView } from "@/components/VaultSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/ipc";
import { entryLabel } from "@/lib/format";
import { clearWindowsHelloCredential, enrollWindowsHello } from "@/lib/windowsHello";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import {
  filterEntries,
  folderCounts as computeFolderCounts,
  isDocument,
  isPassword,
  useVaultStore,
} from "@/store/vaultStore";
import type { BiometricStatus, DocumentMetaInput, EntryInput, VaultEntry } from "@/types";

const PERSONAL_DOCUMENTS =
  "C:\\Users\\dania\\Documents\\Stuff\\Personal_Documents";

type VaultListView = Exclude<VaultNavView, "settings">;

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

  const [view, setView] = useState<VaultNavView>("all");
  const [lastVaultView, setLastVaultView] = useState<VaultListView>("all");
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
  const folderCountMap = useMemo(() => computeFolderCounts(entries), [entries]);

  const kindFilter =
    view === "passwords" ? "password" : view === "documents" ? "document" : "all";

  const visibleEntries = useMemo(
    () => filterEntries(entries, query, folderFilter, tagFilter, kindFilter),
    [entries, query, folderFilter, tagFilter, kindFilter],
  );

  function goToVaultView(next: VaultListView) {
    setLastVaultView(next);
    setView(next);
  }

  function handleViewChange(next: VaultNavView) {
    if (next === "settings") {
      setView("settings");
      refreshBiometric().catch(() => undefined);
      return;
    }
    goToVaultView(next);
  }

  function selectFolder(folder: string | null) {
    if (view === "settings") {
      goToVaultView(lastVaultView);
    }
    setFolderFilter(folder);
  }

  function selectTag(tag: string | null) {
    if (view === "settings") {
      goToVaultView(lastVaultView);
    }
    setTagFilter(tag);
  }

  function clearFilters() {
    setQuery("");
    setFolderFilter(null);
    setTagFilter(null);
  }

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

  function toastFolderImport(
    imported: VaultEntry[],
    skipped: { path: string; reason: string }[],
    emptyMessage: string,
  ) {
    if (!imported.length && !skipped.length) {
      toast.info(emptyMessage);
      return;
    }
    if (imported.length) {
      toast.success(
        `Encrypted ${imported.length} document${imported.length === 1 ? "" : "s"} into the vault`,
      );
      goToVaultView("documents");
    }
    if (skipped.length) {
      toast.message(`Skipped ${skipped.length} file${skipped.length === 1 ? "" : "s"}`, {
        description: skipped
          .slice(0, 3)
          .map((item) => item.reason)
          .join(" · "),
      });
    }
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
      goToVaultView("documents");
    } catch (cause) {
      toast.error("Document import failed", { description: String(cause) });
    } finally {
      setImporting(false);
    }
  }

  async function importPersonalFolder() {
    setImporting(true);
    try {
      const result = await importDocumentsFromFolder(PERSONAL_DOCUMENTS, "Personal Documents");
      toastFolderImport(result.imported, result.skipped, "No importable files found in Personal Documents");
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
      const result = await importDocumentsFromFolder(path, "Imported Documents");
      toastFolderImport(result.imported, result.skipped, "No importable files found in that folder");
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
    <main className="aegis-app-bg aegis-shell min-h-[100dvh] w-full">
      <div className="flex w-full min-h-[100dvh] gap-0 lg:gap-4 lg:p-4">
        <div className="sticky top-0 hidden lg:block">
          <VaultSidebar
            view={view}
            onViewChange={handleViewChange}
            totalCount={entries.length}
            passwordCount={passwordCount}
            documentCount={documentCount}
            folders={folders}
            folderCounts={folderCountMap}
            folderFilter={folderFilter}
            onFolderSelect={selectFolder}
            tags={tags}
            tagFilter={tagFilter}
            onTagSelect={selectTag}
            onLock={lockNow}
          />
        </div>

        <section className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:p-0">
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
                    onClick={() => handleViewChange(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {view !== "settings" ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="lg:hidden" size="sm" variant="outline">
                        <Folder className="size-4" />
                        Folders
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Folders</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => selectFolder(null)}>
                        All folders
                        <span className="ml-auto text-xs text-muted-foreground">{entries.length}</span>
                      </DropdownMenuItem>
                      {folders.map((folder) => (
                        <DropdownMenuItem key={folder} onClick={() => selectFolder(folder)}>
                          {folder}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {folderCountMap[folder] ?? 0}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      {tags.length ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Tags</DropdownMenuLabel>
                          {tags.map((tag) => (
                            <DropdownMenuItem key={tag} onClick={() => selectTag(tag)}>
                              {tag}
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>

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
                Lock
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
              <div className="flex flex-col gap-3">
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

                {hasFilters ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {query ? (
                      <FilterChip label={`Search: ${query}`} onClear={() => setQuery("")} />
                    ) : null}
                    {folderFilter ? (
                      <FilterChip
                        label={`Folder: ${folderFilter}`}
                        onClear={() => setFolderFilter(null)}
                      />
                    ) : null}
                    {tagFilter ? (
                      <FilterChip label={`Tag: ${tagFilter}`} onClear={() => setTagFilter(null)} />
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : null}
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
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2.5 pb-4 pr-3">
                    {visibleEntries.map((entry) => (
                      <EntryRow
                        entry={entry}
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
                  view={
                    view === "documents" ? "documents" : view === "passwords" ? "passwords" : "all"
                  }
                  onAddPassword={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  onAddDocuments={importDocuments}
                  onImportPersonal={importPersonalFolder}
                  onClearFilters={clearFilters}
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

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge className="gap-1 pr-1" variant="secondary">
      <span className="max-w-[14rem] truncate">{label}</span>
      <button
        aria-label={`Clear ${label}`}
        className="rounded-full p-0.5 hover:bg-foreground/10"
        onClick={onClear}
        type="button"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function EmptyState({
  hasFilters,
  view,
  onAddPassword,
  onAddDocuments,
  onImportPersonal,
  onClearFilters,
}: {
  hasFilters: boolean;
  view: "all" | "passwords" | "documents";
  onAddPassword: () => void;
  onAddDocuments: () => void;
  onImportPersonal: () => void;
  onClearFilters: () => void;
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
    <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed py-20 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card text-muted-foreground">
        {view === "documents" ? <FileText className="size-6" /> : <Shield className="size-6" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {hasFilters ? (
        <Button className="mt-5" variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : (
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
      )}
    </div>
  );
}
