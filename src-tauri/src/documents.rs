use std::{
    fs,
    path::{Path, PathBuf},
};

use base64::Engine;
use tauri::{AppHandle, State};
use uuid::Uuid;
use zeroize::{Zeroize, Zeroizing};

use crate::{
    crypto::{decrypt, encrypt},
    db,
    error::{AegisError, Result},
    keystore::AppState,
    security::validate_user_file_path,
    vault::{clean_optional, clean_tags, VaultEntry},
};

pub const KIND_PASSWORD: &str = "password";
pub const KIND_DOCUMENT: &str = "document";
const MAX_DOCUMENT_BYTES: usize = 25 * 1024 * 1024;
const BLOBS_DIR: &str = "blobs";

#[derive(Debug, Clone, serde::Deserialize)]
pub struct DocumentMetaInput {
    pub title: String,
    pub notes: String,
    pub folder: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DocumentPreview {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub data_base64: String,
}

fn blobs_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = db::vault_dir(app)?.join(BLOBS_DIR);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn blob_path(app: &AppHandle, id: &str) -> Result<PathBuf> {
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AegisError::InvalidInput("invalid document id".to_string()));
    }
    Ok(blobs_dir(app)?.join(format!("{id}.enc")))
}

fn guess_mime(path: &Path) -> String {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "png" => "image/png".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        "pdf" => "application/pdf".to_string(),
        "txt" => "text/plain".to_string(),
        "md" => "text/markdown".to_string(),
        "json" => "application/json".to_string(),
        "csv" => "text/csv".to_string(),
        "doc" => "application/msword".to_string(),
        "docx" => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string()
        }
        "xls" => "application/vnd.ms-excel".to_string(),
        "xlsx" => {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string()
        }
        other if !other.is_empty() => format!("application/{other}"),
        _ => "application/octet-stream".to_string(),
    }
}

fn title_from_filename(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(filename)
        .replace('_', " ")
        .replace('-', " ")
}

pub fn write_encrypted_blob(app: &AppHandle, key: &[u8; 32], id: &str, bytes: &[u8]) -> Result<()> {
    if bytes.len() > MAX_DOCUMENT_BYTES {
        return Err(AegisError::InvalidInput(format!(
            "document exceeds {} MB limit",
            MAX_DOCUMENT_BYTES / (1024 * 1024)
        )));
    }
    let encrypted = encrypt(key, bytes)?;
    fs::write(blob_path(app, id)?, encrypted)?;
    Ok(())
}

pub fn read_encrypted_blob(app: &AppHandle, key: &[u8; 32], id: &str) -> Result<Vec<u8>> {
    let path = blob_path(app, id)?;
    if !path.exists() {
        return Err(AegisError::EntryNotFound);
    }
    let encrypted = fs::read(path)?;
    decrypt(key, &encrypted)
}

pub fn delete_blob(app: &AppHandle, id: &str) -> Result<()> {
    let path = blob_path(app, id)?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn persist_document_meta(
    app: &AppHandle,
    key: &[u8; 32],
    entry: &VaultEntry,
) -> Result<VaultEntry> {
    let conn = db::open_encrypted(app, key)?;
    let plaintext = Zeroizing::new(serde_json::to_vec(entry)?);
    let encrypted = encrypt(key, &plaintext)?;
    db::upsert_entry(
        &conn,
        &entry.id,
        &encrypted,
        &entry.created_at,
        &entry.updated_at,
    )?;
    Ok(entry.clone())
}

fn import_document_with_key(
    app: &AppHandle,
    key: &[u8; 32],
    path: &Path,
    folder: Option<String>,
    tags: Vec<String>,
    notes: Option<String>,
) -> Result<VaultEntry> {
    let path = validate_user_file_path(
        path.to_str()
            .ok_or_else(|| AegisError::InvalidInput("invalid file path".to_string()))?,
        true,
    )?;
    let bytes = fs::read(&path)?;
    if bytes.is_empty() {
        return Err(AegisError::InvalidInput(
            "cannot import an empty file".to_string(),
        ));
    }
    if bytes.len() > MAX_DOCUMENT_BYTES {
        return Err(AegisError::InvalidInput(format!(
            "document exceeds {} MB limit",
            MAX_DOCUMENT_BYTES / (1024 * 1024)
        )));
    }

    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("document")
        .to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    write_encrypted_blob(app, key, &id, &bytes)?;

    let entry = VaultEntry {
        kind: KIND_DOCUMENT.to_string(),
        id,
        url: String::new(),
        username: String::new(),
        password: String::new(),
        notes: notes.unwrap_or_default(),
        folder: clean_optional(folder),
        tags: clean_tags(tags),
        created_at: now.clone(),
        updated_at: now,
        title: title_from_filename(&filename),
        filename,
        mime_type: guess_mime(&path),
        size_bytes: bytes.len() as u64,
    };
    persist_document_meta(app, key, &entry)
}

#[tauri::command]
pub fn import_document(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    folder: Option<String>,
    tags: Vec<String>,
    notes: Option<String>,
) -> Result<VaultEntry> {
    let key = Zeroizing::new(state.key_copy()?);
    import_document_with_key(&app, &key, Path::new(&path), folder, tags, notes)
}

#[tauri::command]
pub fn import_documents_from_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    folder: Option<String>,
) -> Result<Vec<VaultEntry>> {
    let key = Zeroizing::new(state.key_copy()?);
    let folder_path = validate_user_file_path(&path, true)?;
    if !folder_path.is_dir() {
        return Err(AegisError::InvalidInput(
            "path must be a directory".to_string(),
        ));
    }

    let mut imported = Vec::new();
    let mut entries = fs::read_dir(&folder_path)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    entries.sort();

    let target_folder = folder.or_else(|| Some("Personal Documents".to_string()));
    for file_path in entries {
        match import_document_with_key(
            &app,
            &key,
            &file_path,
            target_folder.clone(),
            vec!["identity".to_string()],
            None,
        ) {
            Ok(entry) => imported.push(entry),
            Err(AegisError::InvalidInput(_)) => continue,
            Err(error) => return Err(error),
        }
    }

    Ok(imported)
}

#[tauri::command]
pub fn update_document_meta(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    input: DocumentMetaInput,
) -> Result<VaultEntry> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let existing_blob = db::encrypted_entry(&conn, &id)?;
    let mut existing = crate::vault::decrypt_entry(&key, &existing_blob)?;
    if existing.kind != KIND_DOCUMENT {
        return Err(AegisError::InvalidInput(
            "entry is not a document".to_string(),
        ));
    }
    existing.title = input.title.trim().to_string();
    if existing.title.is_empty() {
        existing.title = title_from_filename(&existing.filename);
    }
    existing.notes = input.notes;
    existing.folder = clean_optional(input.folder);
    existing.tags = clean_tags(input.tags);
    existing.updated_at = chrono::Utc::now().to_rfc3339();
    persist_document_meta(&app, &key, &existing)
}

#[tauri::command]
pub fn get_document_preview(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<DocumentPreview> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let existing_blob = db::encrypted_entry(&conn, &id)?;
    let entry = crate::vault::decrypt_entry(&key, &existing_blob)?;
    if entry.kind != KIND_DOCUMENT {
        return Err(AegisError::InvalidInput(
            "entry is not a document".to_string(),
        ));
    }
    let mut bytes = Zeroizing::new(read_encrypted_blob(&app, &key, &id)?);
    let data_base64 = base64::engine::general_purpose::STANDARD.encode(bytes.as_slice());
    bytes.zeroize();
    Ok(DocumentPreview {
        id: entry.id,
        filename: entry.filename,
        mime_type: entry.mime_type,
        size_bytes: entry.size_bytes,
        data_base64,
    })
}

#[tauri::command]
pub fn export_document(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    path: String,
) -> Result<()> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let existing_blob = db::encrypted_entry(&conn, &id)?;
    let entry = crate::vault::decrypt_entry(&key, &existing_blob)?;
    if entry.kind != KIND_DOCUMENT {
        return Err(AegisError::InvalidInput(
            "entry is not a document".to_string(),
        ));
    }
    let mut bytes = Zeroizing::new(read_encrypted_blob(&app, &key, &id)?);
    let path = validate_user_file_path(&path, false)?;
    fs::write(path, bytes.as_slice())?;
    bytes.zeroize();
    Ok(())
}

pub fn document_bytes_for_export(app: &AppHandle, key: &[u8; 32], id: &str) -> Result<Vec<u8>> {
    read_encrypted_blob(app, key, id)
}

pub fn restore_document_blob(app: &AppHandle, key: &[u8; 32], id: &str, bytes: &[u8]) -> Result<()> {
    write_encrypted_blob(app, key, id, bytes)
}
