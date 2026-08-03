import { invoke } from "@tauri-apps/api/core";
import type {
  BiometricStatus,
  BreachCheckResult,
  DocumentMetaInput,
  DocumentPreview,
  EntryInput,
  FolderImportResult,
  GeneratePasswordOptions,
  VaultEntry,
} from "@/types";

export const api = {
  vaultExists: () => invoke<boolean>("vault_exists"),
  isUnlocked: () => invoke<boolean>("is_unlocked"),
  createVault: (masterPassword: string) =>
    invoke<void>("create_vault", { masterPassword }),
  unlockVault: (masterPassword: string) =>
    invoke<void>("unlock_vault", { masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),
  setInactivityTimeout: (seconds: number) =>
    invoke<void>("set_inactivity_timeout", { seconds }),

  listEntries: () => invoke<VaultEntry[]>("list_entries"),
  searchVault: (query: string) => invoke<VaultEntry[]>("search_vault", { query }),
  addEntry: (input: EntryInput) => invoke<VaultEntry>("add_entry", { input }),
  getEntry: (id: string) => invoke<VaultEntry>("get_entry", { id }),
  updateEntry: (id: string, input: EntryInput) =>
    invoke<VaultEntry>("update_entry", { id, input }),
  deleteEntry: (id: string) => invoke<void>("delete_entry", { id }),
  listFolders: () => invoke<string[]>("list_folders"),
  listTags: () => invoke<string[]>("list_tags"),

  importDocument: (
    path: string,
    folder?: string | null,
    tags: string[] = [],
    notes?: string | null,
  ) =>
    invoke<VaultEntry>("import_document", {
      path,
      folder: folder ?? null,
      tags,
      notes: notes ?? null,
    }),
  importDocumentsFromFolder: (path: string, folder?: string | null) =>
    invoke<FolderImportResult>("import_documents_from_folder", {
      path,
      folder: folder ?? null,
    }),
  updateDocumentMeta: (id: string, input: DocumentMetaInput) =>
    invoke<VaultEntry>("update_document_meta", { id, input }),
  getDocumentPreview: (id: string) =>
    invoke<DocumentPreview>("get_document_preview", { id }),
  exportDocument: (id: string, path: string) =>
    invoke<void>("export_document", { id, path }),

  generatePassword: (options: GeneratePasswordOptions) =>
    invoke<string>("generate_password", { options }),
  copySecret: (text: string) => invoke<void>("copy_secret", { text }),
  checkPasswordBreach: (password: string) =>
    invoke<BreachCheckResult>("check_password_breach", { password }),

  exportVault: (passphrase: string, path: string) =>
    invoke<void>("export_vault", { passphrase, path }),
  importEncryptedBackup: (passphrase: string, path: string) =>
    invoke<VaultEntry[]>("import_encrypted_backup", { passphrase, path }),
  importBitwardenCsv: (path: string) =>
    invoke<VaultEntry[]>("import_bitwarden_csv", { path }),

  biometricStatus: () => invoke<BiometricStatus>("biometric_status"),
  enrollBiometric: () => invoke<void>("enroll_biometric"),
  biometricUnlock: () => invoke<void>("biometric_unlock"),
  disableBiometric: () => invoke<void>("disable_biometric"),
};
