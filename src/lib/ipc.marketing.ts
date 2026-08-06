import type {
  BiometricStatus,
  BreachCheckResult,
  DocumentMetaInput,
  DocumentPreview,
  EntryInput,
  ExportResult,
  FolderImportResult,
  GeneratePasswordOptions,
  ListEntriesResult,
  VaultEntry,
} from "@/types";
import { DEMO_ENTRIES, DEMO_FOLDERS, DEMO_TAGS } from "@/marketing/demo-data";

const noop = async () => undefined;

const demoBiometric: BiometricStatus = {
  available: true,
  enrolled: true,
  message: "Windows Hello is available for this vault.",
};

const demoPreview: DocumentPreview = {
  id: "doc-passport",
  filename: "passport-scan.pdf",
  mime_type: "application/pdf",
  size_bytes: 245_760,
  data_base64: "",
};

export const api = {
  vaultExists: async () => false,
  isUnlocked: async () => true,
  createVault: noop,
  unlockVault: noop,
  lockVault: noop,
  setInactivityTimeout: noop,
  touchActivity: noop,
  changeMasterPassword: noop,
  destroyVault: noop,

  listEntries: async (): Promise<ListEntriesResult> => ({
    entries: DEMO_ENTRIES,
    skipped_corrupt: 0,
  }),
  searchVault: async () => DEMO_ENTRIES,
  addEntry: async (input: EntryInput) =>
    ({
      kind: "password",
      id: "new",
      title: "",
      url: input.url,
      username: input.username,
      password: input.password,
      notes: input.notes,
      folder: input.folder,
      tags: input.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      filename: "",
      mime_type: "",
      size_bytes: 0,
    }) satisfies VaultEntry,
  getEntry: async () => ({}) as VaultEntry,
  updateEntry: async (_id: string, input: EntryInput) =>
    ({
      kind: "password",
      id: "updated",
      title: "",
      url: input.url,
      username: input.username,
      password: input.password,
      notes: input.notes,
      folder: input.folder,
      tags: input.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      filename: "",
      mime_type: "",
      size_bytes: 0,
    }) satisfies VaultEntry,
  deleteEntry: noop,
  listFolders: async () => DEMO_FOLDERS,
  listTags: async () => DEMO_TAGS,

  importDocument: async () => ({}) as VaultEntry,
  importDocumentsFromFolder: async () =>
    ({ imported: [], skipped: [] }) satisfies FolderImportResult,
  updateDocumentMeta: async (_id: string, input: DocumentMetaInput) =>
    ({
      kind: "document",
      id: "doc-passport",
      title: input.title,
      notes: input.notes,
      folder: input.folder,
      tags: input.tags,
      url: "",
      username: "",
      password: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      filename: "passport-scan.pdf",
      mime_type: "application/pdf",
      size_bytes: 245_760,
    }) satisfies VaultEntry,
  getDocumentPreview: async () => demoPreview,
  exportDocument: noop,

  generatePassword: async (options: GeneratePasswordOptions) =>
    "Xk9#mP2vL8@nQ".slice(0, Math.max(8, options.length)),
  copySecret: noop,
  checkPasswordBreach: async (): Promise<BreachCheckResult> => ({ found: false, count: 0 }),
  openExternalUrl: noop,

  exportVault: async (): Promise<ExportResult> => ({
    entry_count: 4,
    document_count: 1,
    missing_blob_count: 0,
  }),
  importEncryptedBackup: async () => [] as VaultEntry[],
  importBitwardenCsv: async () => [] as VaultEntry[],

  biometricStatus: async () => demoBiometric,
  enrollBiometric: noop,
  biometricUnlock: noop,
  disableBiometric: noop,
};
