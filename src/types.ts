export type VaultItemKind = "password" | "document";

export type VaultEntry = {
  kind: VaultItemKind | string;
  id: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
};

export type EntryInput = {
  url: string;
  username: string;
  password: string;
  notes: string;
  folder?: string | null;
  tags: string[];
};

export type DocumentMetaInput = {
  title: string;
  notes: string;
  folder?: string | null;
  tags: string[];
};

export type DocumentPreview = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  data_base64: string;
};

export type FolderImportResult = {
  imported: VaultEntry[];
  skipped: { path: string; reason: string }[];
};

export type ExportResult = {
  entry_count: number;
  document_count: number;
  missing_blob_count: number;
};

export type ListEntriesResult = {
  entries: VaultEntry[];
  skipped_corrupt: number;
};

export type GeneratePasswordOptions = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export type BreachCheckResult = {
  found: boolean;
  count: number;
};

export type BiometricStatus = {
  available: boolean;
  enrolled: boolean;
  message: string;
};
