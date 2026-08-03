use std::{collections::BTreeSet, fs};

use base64::Engine;
use rand::{rngs::OsRng, seq::SliceRandom, Rng};
use tauri::{AppHandle, State};
use uuid::Uuid;
use zeroize::{Zeroize, Zeroizing};

use crate::{
    crypto::{decrypt, derive_key, encrypt, random_bytes, KdfParams, SALT_LEN},
    db,
    documents::{self, KIND_DOCUMENT, KIND_PASSWORD},
    error::{AegisError, Result},
    keystore::AppState,
    security::validate_user_file_path,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultEntry {
    #[serde(default = "default_kind")]
    pub kind: String,
    pub id: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub notes: String,
    pub folder: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub filename: String,
    #[serde(default)]
    pub mime_type: String,
    #[serde(default)]
    pub size_bytes: u64,
}

fn default_kind() -> String {
    KIND_PASSWORD.to_string()
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct EntryInput {
    pub url: String,
    pub username: String,
    pub password: String,
    pub notes: String,
    pub folder: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct GeneratePasswordOptions {
    pub length: usize,
    pub uppercase: bool,
    pub lowercase: bool,
    pub numbers: bool,
    pub symbols: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportDocumentBlob {
    pub id: String,
    pub content_b64: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportFile {
    pub version: u32,
    pub salt_b64: String,
    pub kdf: KdfParams,
    pub encrypted_blob_b64: String,
    pub exported_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ExportPayloadV2 {
    entries: Vec<VaultEntry>,
    documents: Vec<ExportDocumentBlob>,
}

#[tauri::command]
pub fn add_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EntryInput,
) -> Result<VaultEntry> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let now = chrono::Utc::now().to_rfc3339();
    let entry = VaultEntry {
        kind: KIND_PASSWORD.to_string(),
        id: Uuid::new_v4().to_string(),
        url: input.url.trim().to_string(),
        username: input.username.trim().to_string(),
        password: input.password,
        notes: input.notes,
        folder: clean_optional(input.folder),
        tags: clean_tags(input.tags),
        created_at: now.clone(),
        updated_at: now,
        title: String::new(),
        filename: String::new(),
        mime_type: String::new(),
        size_bytes: 0,
    };
    let plaintext = Zeroizing::new(serde_json::to_vec(&entry)?);
    let encrypted = encrypt(&key, &plaintext)?;
    db::upsert_entry(
        &conn,
        &entry.id,
        &encrypted,
        &entry.created_at,
        &entry.updated_at,
    )?;
    Ok(entry)
}

#[tauri::command]
pub fn get_entry(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<VaultEntry> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let blob = db::encrypted_entry(&conn, &id)?;
    decrypt_entry(&key, &blob)
}

#[tauri::command]
pub fn list_entries(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<VaultEntry>> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let mut entries = Vec::new();
    let mut skipped = 0u32;
    for blob in db::all_encrypted_entries(&conn)? {
        match decrypt_entry(&key, &blob) {
            Ok(entry) => entries.push(normalize_entry(entry)),
            Err(error) => {
                skipped += 1;
                eprintln!("aegis: skipping undecryptable vault entry: {error}");
            }
        }
    }
    if skipped > 0 {
        eprintln!("aegis: skipped {skipped} corrupt or unreadable vault entr(y/ies)");
    }
    Ok(entries)
}

#[tauri::command]
pub fn search_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<VaultEntry>> {
    let needle = query.trim().to_lowercase();
    let entries = list_entries(app, state)?;
    if needle.is_empty() {
        return Ok(entries);
    }
    Ok(entries
        .into_iter()
        .filter(|entry| {
            entry.url.to_lowercase().contains(&needle)
                || entry.username.to_lowercase().contains(&needle)
                || entry.notes.to_lowercase().contains(&needle)
                || entry.title.to_lowercase().contains(&needle)
                || entry.filename.to_lowercase().contains(&needle)
                || entry.mime_type.to_lowercase().contains(&needle)
                || entry
                    .folder
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&needle)
                || entry
                    .tags
                    .iter()
                    .any(|tag| tag.to_lowercase().contains(&needle))
        })
        .collect())
}

#[tauri::command]
pub fn update_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    input: EntryInput,
) -> Result<VaultEntry> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    let existing_blob = db::encrypted_entry(&conn, &id)?;
    let existing = decrypt_entry(&key, &existing_blob)?;
    if existing.kind == KIND_DOCUMENT {
        return Err(AegisError::InvalidInput(
            "use update_document_meta for documents".to_string(),
        ));
    }
    let entry = VaultEntry {
        kind: KIND_PASSWORD.to_string(),
        id,
        url: input.url.trim().to_string(),
        username: input.username.trim().to_string(),
        password: input.password,
        notes: input.notes,
        folder: clean_optional(input.folder),
        tags: clean_tags(input.tags),
        created_at: existing.created_at,
        updated_at: chrono::Utc::now().to_rfc3339(),
        title: String::new(),
        filename: String::new(),
        mime_type: String::new(),
        size_bytes: 0,
    };
    let plaintext = Zeroizing::new(serde_json::to_vec(&entry)?);
    let encrypted = encrypt(&key, &plaintext)?;
    db::upsert_entry(
        &conn,
        &entry.id,
        &encrypted,
        &entry.created_at,
        &entry.updated_at,
    )?;
    Ok(entry)
}

#[tauri::command]
pub fn delete_entry(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<()> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    // Always attempt blob cleanup so document files are not orphaned when meta decrypt fails.
    let _ = documents::delete_blob(&app, &id);
    db::delete_entry(&conn, &id)
}

#[tauri::command]
pub fn list_folders(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<String>> {
    let mut folders = BTreeSet::new();
    for entry in list_entries(app, state)? {
        if let Some(folder) = entry.folder {
            folders.insert(folder);
        }
    }
    Ok(folders.into_iter().collect())
}

#[tauri::command]
pub fn list_tags(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<String>> {
    let mut tags = BTreeSet::new();
    for entry in list_entries(app, state)? {
        for tag in entry.tags {
            tags.insert(tag);
        }
    }
    Ok(tags.into_iter().collect())
}

#[tauri::command]
pub fn generate_password(
    state: State<'_, AppState>,
    options: GeneratePasswordOptions,
) -> Result<String> {
    let _ = state.key_copy()?;
    let length = options.length.clamp(8, 128);
    let mut pools: Vec<&[u8]> = Vec::new();
    if options.lowercase {
        pools.push(b"abcdefghijkmnopqrstuvwxyz");
    }
    if options.uppercase {
        pools.push(b"ABCDEFGHJKLMNPQRSTUVWXYZ");
    }
    if options.numbers {
        pools.push(b"23456789");
    }
    if options.symbols {
        pools.push(b"!@#$%^&*()-_=+[]{};:,.?");
    }
    if pools.is_empty() {
        return Err(AegisError::InvalidInput(
            "select at least one character set".to_string(),
        ));
    }

    let mut rng = OsRng;
    let mut bytes = Vec::with_capacity(length);
    for pool in &pools {
        bytes.push(*pool.choose(&mut rng).ok_or(AegisError::Crypto)?);
    }
    let all: Vec<u8> = pools.iter().flat_map(|pool| pool.iter().copied()).collect();
    while bytes.len() < length {
        let idx = rng.gen_range(0..all.len());
        bytes.push(all[idx]);
    }
    bytes.shuffle(&mut rng);
    String::from_utf8(bytes).map_err(|_| AegisError::Crypto)
}

#[tauri::command]
pub fn export_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    passphrase: String,
    path: String,
) -> Result<()> {
    if passphrase.len() < 12 {
        return Err(AegisError::InvalidInput(
            "export passphrase must be at least 12 characters".to_string(),
        ));
    }
    let key = Zeroizing::new(state.key_copy()?);
    let entries = list_entries(app.clone(), state)?;
    let mut documents = Vec::new();
    let mut missing_blobs = 0u32;
    for entry in &entries {
        if entry.kind == KIND_DOCUMENT {
            match documents::document_bytes_for_export(&app, &key, &entry.id) {
                Ok(raw) => {
                    let mut bytes = Zeroizing::new(raw);
                    documents.push(ExportDocumentBlob {
                        id: entry.id.clone(),
                        content_b64: base64::engine::general_purpose::STANDARD_NO_PAD
                            .encode(bytes.as_slice()),
                    });
                    bytes.zeroize();
                }
                Err(error) => {
                    missing_blobs += 1;
                    eprintln!(
                        "aegis: skipping missing document blob {} during export: {error}",
                        entry.id
                    );
                }
            }
        }
    }
    if missing_blobs > 0 {
        eprintln!("aegis: export continued with {missing_blobs} missing document blob(s)");
    }

    let payload = ExportPayloadV2 {
        entries,
        documents,
    };
    let salt = random_bytes::<SALT_LEN>();
    let kdf = KdfParams::default();
    let export_key = derive_key(&passphrase, &salt, &kdf)?;
    let plaintext = Zeroizing::new(serde_json::to_vec(&payload)?);
    let encrypted = encrypt(&export_key, &plaintext)?;
    let file = ExportFile {
        version: 2,
        salt_b64: base64::engine::general_purpose::STANDARD_NO_PAD.encode(salt),
        kdf,
        encrypted_blob_b64: base64::engine::general_purpose::STANDARD_NO_PAD.encode(encrypted),
        exported_at: chrono::Utc::now().to_rfc3339(),
    };
    let path = validate_user_file_path(&path, false)?;
    fs::write(path, serde_json::to_string_pretty(&file)?)?;
    Ok(())
}

#[tauri::command]
pub fn import_encrypted_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    passphrase: String,
    path: String,
) -> Result<Vec<VaultEntry>> {
    let contents = fs::read_to_string(validate_user_file_path(&path, true)?)?;
    let file: ExportFile = serde_json::from_str(&contents)?;
    if file.version != 1 && file.version != 2 {
        return Err(AegisError::InvalidInput(format!(
            "unsupported backup version {}; versions 1 and 2 are supported",
            file.version
        )));
    }
    let salt = base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(file.salt_b64)
        .map_err(|_| AegisError::InvalidInput("invalid backup".to_string()))?;
    let export_key = derive_key(&passphrase, &salt, &file.kdf)?;
    let encrypted = base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(file.encrypted_blob_b64)
        .map_err(|_| AegisError::InvalidInput("invalid backup".to_string()))?;
    let plaintext = Zeroizing::new(decrypt(&export_key, &encrypted)?);

    let (entries, document_blobs) = if file.version == 1 {
        let entries: Vec<VaultEntry> = serde_json::from_slice(&plaintext)?;
        (entries, Vec::new())
    } else {
        let payload: ExportPayloadV2 = serde_json::from_slice(&plaintext)?;
        (payload.entries, payload.documents)
    };

    let key = Zeroizing::new(state.key_copy()?);
    let mut id_map = std::collections::HashMap::<String, String>::new();
    let conn = db::open_encrypted(&app, &key)?;
    let mut remapped = Vec::with_capacity(entries.len());
    for mut entry in entries {
        entry = normalize_entry(entry);
        let original_id = entry.id.clone();
        if entry.id.trim().is_empty() || db::encrypted_entry(&conn, &entry.id).is_ok() {
            entry.id = Uuid::new_v4().to_string();
        }
        if entry.kind == KIND_DOCUMENT && original_id != entry.id {
            id_map.insert(original_id, entry.id.clone());
        }
        remapped.push(entry);
    }

    for blob in document_blobs {
        let target_id = id_map
            .get(&blob.id)
            .cloned()
            .unwrap_or_else(|| blob.id.clone());
        let bytes = base64::engine::general_purpose::STANDARD_NO_PAD
            .decode(blob.content_b64)
            .map_err(|_| AegisError::InvalidInput("invalid document blob".to_string()))?;
        documents::restore_document_blob(&app, &key, &target_id, &bytes)?;
    }

    insert_imported_entries(app, state, remapped)
}

#[tauri::command]
pub fn import_bitwarden_csv(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<VaultEntry>> {
    let mut rdr = csv::Reader::from_path(validate_user_file_path(&path, true)?)
        .map_err(|_| AegisError::Filesystem)?;
    let headers = rdr
        .headers()
        .map_err(|_| AegisError::InvalidInput("invalid CSV".to_string()))?
        .clone();
    let mut entries = Vec::new();
    for row in rdr.records() {
        let row = row.map_err(|_| AegisError::InvalidInput("invalid CSV".to_string()))?;
        let field = |name: &str| -> String {
            headers
                .iter()
                .position(|header| header.eq_ignore_ascii_case(name))
                .and_then(|idx| row.get(idx))
                .unwrap_or_default()
                .to_string()
        };
        let now = chrono::Utc::now().to_rfc3339();
        let folder = clean_optional(Some(field("folder")));
        let tags = field("tags")
            .split(',')
            .map(str::to_string)
            .collect::<Vec<_>>();

        let name = field("name");
        let url = field("login_uri");
        let mut notes = field("notes");
        if !name.is_empty() && !url.is_empty() && !notes.is_empty() {
            notes = format!("Name: {}\n\n{}", name, notes);
        } else if !name.is_empty() && !url.is_empty() {
            notes = format!("Name: {}", name);
        }

        entries.push(VaultEntry {
            kind: KIND_PASSWORD.to_string(),
            id: Uuid::new_v4().to_string(),
            url: if url.is_empty() { name.clone() } else { url },
            username: field("login_username"),
            password: field("login_password"),
            notes,
            folder,
            tags: clean_tags(tags),
            created_at: now.clone(),
            updated_at: now,
            title: String::new(),
            filename: String::new(),
            mime_type: String::new(),
            size_bytes: 0,
        });
    }
    insert_imported_entries(app, state, entries)
}

fn insert_imported_entries(
    app: AppHandle,
    state: State<'_, AppState>,
    mut entries: Vec<VaultEntry>,
) -> Result<Vec<VaultEntry>> {
    let key = Zeroizing::new(state.key_copy()?);
    let conn = db::open_encrypted(&app, &key)?;
    for entry in &mut entries {
        *entry = normalize_entry(entry.clone());
        let previous_id = entry.id.clone();
        // Mint a new ID on empty or collision so restores never silently overwrite.
        if entry.id.trim().is_empty() || db::encrypted_entry(&conn, &entry.id).is_ok() {
            entry.id = Uuid::new_v4().to_string();
            if entry.kind == KIND_DOCUMENT
                && !previous_id.trim().is_empty()
                && previous_id != entry.id
            {
                let _ = documents::rename_blob(&app, &previous_id, &entry.id);
            }
        }
        entry.updated_at = chrono::Utc::now().to_rfc3339();
        let plaintext = Zeroizing::new(serde_json::to_vec(entry)?);
        let encrypted = encrypt(&key, &plaintext)?;
        db::upsert_entry(
            &conn,
            &entry.id,
            &encrypted,
            &entry.created_at,
            &entry.updated_at,
        )?;
    }
    Ok(entries)
}

pub fn normalize_kind(kind: &str) -> String {
    match kind.trim().to_ascii_lowercase().as_str() {
        KIND_DOCUMENT => KIND_DOCUMENT.to_string(),
        _ => KIND_PASSWORD.to_string(),
    }
}

pub fn normalize_entry(mut entry: VaultEntry) -> VaultEntry {
    entry.kind = normalize_kind(&entry.kind);
    entry
}

pub fn decrypt_entry(key: &[u8; 32], blob: &[u8]) -> Result<VaultEntry> {
    let mut plaintext = Zeroizing::new(decrypt(key, blob)?);
    let entry: VaultEntry = serde_json::from_slice(&plaintext)?;
    plaintext.zeroize();
    Ok(normalize_entry(entry))
}

pub fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

pub fn clean_tags(tags: Vec<String>) -> Vec<String> {
    let mut cleaned = BTreeSet::new();
    for tag in tags {
        let tag = tag.trim().trim_start_matches('#').to_string();
        if !tag.is_empty() {
            cleaned.insert(tag);
        }
    }
    cleaned.into_iter().collect()
}
