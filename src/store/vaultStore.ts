import { create } from "zustand";
import { api } from "@/lib/ipc";
import type { DocumentMetaInput, EntryInput, VaultEntry } from "@/types";

type VaultState = {
  entries: VaultEntry[];
  folders: string[];
  tags: string[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: EntryInput) => Promise<VaultEntry>;
  update: (id: string, input: EntryInput) => Promise<VaultEntry>;
  importDocument: (
    path: string,
    folder?: string | null,
    tags?: string[],
    notes?: string | null,
  ) => Promise<VaultEntry>;
  importDocumentsFromFolder: (path: string, folder?: string | null) => Promise<{
    imported: VaultEntry[];
    skipped: { path: string; reason: string }[];
  }>;
  updateDocument: (id: string, input: DocumentMetaInput) => Promise<VaultEntry>;
  remove: (id: string) => Promise<void>;
  wipe: () => void;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function normalizeKind(kind: string | undefined | null): "password" | "document" {
  const value = (kind ?? "").trim().toLowerCase();
  return value === "document" ? "document" : "password";
}

function normalizeEntry(entry: VaultEntry): VaultEntry {
  return {
    ...entry,
    kind: normalizeKind(entry.kind),
    title: entry.title || "",
    filename: entry.filename || "",
    mime_type: entry.mime_type || "",
    size_bytes: entry.size_bytes || 0,
    tags: entry.tags || [],
  };
}

function deriveFacets(entries: VaultEntry[]) {
  return {
    folders: Array.from(
      new Set(entries.map((entry) => entry.folder).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b)),
    tags: Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

function upsert(entries: VaultEntry[], entry: VaultEntry) {
  return [entry, ...entries.filter((current) => current.id !== entry.id)];
}

export const useVaultStore = create<VaultState>((set, get) => ({
  entries: [],
  folders: [],
  tags: [],
  loaded: false,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const entries = (await api.listEntries()).map(normalizeEntry);
      set({ entries, ...deriveFacets(entries), loaded: true, loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },
  add: async (input) => {
    const entry = normalizeEntry(await api.addEntry(input));
    const entries = upsert(get().entries, entry);
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
    return entry;
  },
  update: async (id, input) => {
    const entry = normalizeEntry(await api.updateEntry(id, input));
    const entries = upsert(get().entries, entry);
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
    return entry;
  },
  importDocument: async (path, folder, tags = [], notes) => {
    const entry = normalizeEntry(await api.importDocument(path, folder, tags, notes));
    const entries = upsert(get().entries, entry);
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
    return entry;
  },
  importDocumentsFromFolder: async (path, folder) => {
    const result = await api.importDocumentsFromFolder(path, folder);
    const imported = result.imported.map(normalizeEntry);
    let entries = get().entries;
    for (const entry of imported) {
      entries = upsert(entries, entry);
    }
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
    return { imported, skipped: result.skipped };
  },
  updateDocument: async (id, input) => {
    const entry = normalizeEntry(await api.updateDocumentMeta(id, input));
    const entries = upsert(get().entries, entry);
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
    return entry;
  },
  remove: async (id) => {
    await api.deleteEntry(id);
    const entries = get().entries.filter((entry) => entry.id !== id);
    set({ entries, ...deriveFacets(entries), loaded: true, error: null });
  },
  wipe: () =>
    set({
      entries: [],
      folders: [],
      tags: [],
      loaded: false,
      loading: false,
      error: null,
    }),
}));

export function isDocument(entry: VaultEntry) {
  return normalizeKind(entry.kind) === "document";
}

export function isPassword(entry: VaultEntry) {
  return normalizeKind(entry.kind) === "password";
}

/** Total item count per folder (all kinds). Stable across Passwords/Documents views. */
export function folderCounts(entries: VaultEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const folder = entry.folder?.trim();
    if (!folder) continue;
    counts[folder] = (counts[folder] ?? 0) + 1;
  }
  return counts;
}

export function filterEntries(
  entries: VaultEntry[],
  query: string,
  folder: string | null,
  tag: string | null,
  kind: "all" | "password" | "document" = "all",
): VaultEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (kind === "password" && !isPassword(entry)) return false;
    if (kind === "document" && !isDocument(entry)) return false;
    if (folder && entry.folder !== folder) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    if (!needle) return true;
    return (
      entry.url.toLowerCase().includes(needle) ||
      entry.username.toLowerCase().includes(needle) ||
      entry.notes.toLowerCase().includes(needle) ||
      entry.title.toLowerCase().includes(needle) ||
      entry.filename.toLowerCase().includes(needle) ||
      entry.mime_type.toLowerCase().includes(needle) ||
      (entry.folder ?? "").toLowerCase().includes(needle) ||
      entry.tags.some((value) => value.toLowerCase().includes(needle))
    );
  });
}
