use std::fs;

use tauri::{AppHandle, State};
use zeroize::{Zeroize, Zeroizing};

use crate::{
    crypto::{constant_time_eq, decrypt, derive_key, encrypt, random_bytes, KdfParams, SALT_LEN},
    db, documents,
    error::{AegisError, Result},
    keystore::AppState,
    vault::decrypt_entry,
};

const VERIFIER: &[u8] = b"aegis-vault-verifier-v1";
const BIOMETRIC_KEY_FILE: &str = "windows-hello.key";

#[tauri::command]
pub fn vault_exists(app: AppHandle) -> Result<bool> {
    db::vault_exists(&app)
}

#[tauri::command]
pub fn is_unlocked(state: State<'_, AppState>) -> bool {
    state.is_unlocked()
}

#[tauri::command]
pub fn create_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    master_password: String,
) -> Result<()> {
    // Clear stranded partial creates before checking existence.
    db::purge_incomplete_vault(&app)?;
    if db::vault_exists(&app)? {
        return Err(AegisError::VaultExists);
    }
    let mut master_password = master_password;
    validate_master_password(&master_password)?;

    let salt = random_bytes::<SALT_LEN>();
    let meta = db::VaultMeta::new(&salt);
    let key = derive_key(&master_password, &salt, &KdfParams::default())?;
    master_password.zeroize();

    // Write meta first so a crash mid-DB setup leaves a recoverable incomplete state
    // that purge_incomplete_vault can clean, rather than an orphaned ciphertext DB.
    db::write_meta(&app, &meta)?;

    let setup = (|| -> Result<()> {
        let conn = db::open_encrypted(&app, &key)?;
        db::migrate(&conn)?;
        let verifier = encrypt(&key, VERIFIER)?;
        db::insert_verifier(&conn, &verifier)?;
        Ok(())
    })();

    if let Err(error) = setup {
        let _ = db::remove_vault_files(&app);
        return Err(error);
    }

    state.set_key(key)?;
    Ok(())
}

#[tauri::command]
pub fn unlock_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    master_password: String,
) -> Result<()> {
    state.ensure_not_locked_out()?;
    if !db::vault_exists(&app)? {
        return Err(AegisError::VaultMissing);
    }

    let mut master_password = master_password;
    let meta = db::read_meta(&app)?;
    let mut salt = meta.salt()?;
    let key = derive_key(&master_password, &salt, &meta.kdf)?;
    master_password.zeroize();
    salt.zeroize();

    let result = (|| -> Result<()> {
        let conn = db::open_encrypted(&app, &key).map_err(|_| AegisError::InvalidMasterPassword)?;
        let verifier = db::verifier(&conn).map_err(|_| AegisError::InvalidMasterPassword)?;
        let plaintext = decrypt(&key, &verifier).map_err(|_| AegisError::InvalidMasterPassword)?;
        if !constant_time_eq(&plaintext, VERIFIER) {
            return Err(AegisError::InvalidMasterPassword);
        }
        db::migrate(&conn)?;
        Ok(())
    })();

    match result {
        Ok(()) => state.set_key(key),
        Err(AegisError::InvalidMasterPassword) => {
            state.record_failed_unlock();
            Err(AegisError::InvalidMasterPassword)
        }
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<()> {
    state.lock();
    Ok(())
}

#[tauri::command]
pub fn set_inactivity_timeout(state: State<'_, AppState>, seconds: u64) -> Result<()> {
    state.set_inactivity_timeout(seconds)
}

#[tauri::command]
pub fn touch_activity(state: State<'_, AppState>) -> Result<()> {
    state.touch_activity()
}

#[tauri::command]
pub fn change_master_password(
    app: AppHandle,
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<()> {
    if !db::vault_exists(&app)? {
        return Err(AegisError::VaultMissing);
    }
    let _ = state.key_copy()?; // must be unlocked

    let mut current_password = current_password;
    let mut new_password = new_password;
    validate_master_password(&new_password)?;

    let meta = db::read_meta(&app)?;
    let mut salt = meta.salt()?;
    let current_key = derive_key(&current_password, &salt, &meta.kdf)?;
    current_password.zeroize();
    salt.zeroize();

    // Verify the claimed current password against the live vault.
    {
        let conn = db::open_encrypted(&app, &current_key)
            .map_err(|_| AegisError::InvalidMasterPassword)?;
        let verifier = db::verifier(&conn).map_err(|_| AegisError::InvalidMasterPassword)?;
        let plaintext =
            decrypt(&current_key, &verifier).map_err(|_| AegisError::InvalidMasterPassword)?;
        if !constant_time_eq(&plaintext, VERIFIER) {
            return Err(AegisError::InvalidMasterPassword);
        }
    }

    let new_salt = random_bytes::<SALT_LEN>();
    let mut new_meta = db::VaultMeta::new(&new_salt);
    new_meta.created_at = meta.created_at;
    let new_key = derive_key(&new_password, &new_salt, &KdfParams::default())?;
    new_password.zeroize();

    let old_conn = db::open_encrypted(&app, &current_key)?;
    let mut plaintext_entries = Vec::new();
    for blob in db::all_encrypted_entries(&old_conn)? {
        plaintext_entries.push(decrypt_entry(&current_key, &blob)?);
    }
    drop(old_conn);

    let tmp_db = db::vault_dir(&app)?.join("vault.db.tmp");
    if tmp_db.exists() {
        fs::remove_file(&tmp_db)?;
    }

    {
        let new_conn = db::open_encrypted_path(&tmp_db, &new_key)?;
        db::migrate(&new_conn)?;
        let verifier = encrypt(&new_key, VERIFIER)?;
        db::insert_verifier(&new_conn, &verifier)?;
        for entry in &plaintext_entries {
            let plaintext = Zeroizing::new(serde_json::to_vec(entry)?);
            let encrypted = encrypt(&new_key, &plaintext)?;
            db::upsert_entry(
                &new_conn,
                &entry.id,
                &encrypted,
                &entry.created_at,
                &entry.updated_at,
            )?;
        }
    }

    // Re-encrypt document blobs in place via temp files.
    for entry in &plaintext_entries {
        if entry.kind != documents::KIND_DOCUMENT {
            continue;
        }
        match documents::document_bytes_for_export(&app, &current_key, &entry.id) {
            Ok(raw) => {
                let mut bytes = Zeroizing::new(raw);
                documents::write_encrypted_blob(&app, &new_key, &entry.id, &bytes)?;
                bytes.zeroize();
            }
            Err(AegisError::EntryNotFound) => {}
            Err(error) => return Err(error),
        }
    }

    let db_path = db::db_path(&app)?;
    let backup_db = db::vault_dir(&app)?.join("vault.db.bak");
    if backup_db.exists() {
        let _ = fs::remove_file(&backup_db);
    }
    fs::rename(&db_path, &backup_db)?;
    if let Err(error) = fs::rename(&tmp_db, &db_path) {
        let _ = fs::rename(&backup_db, &db_path);
        return Err(error.into());
    }
    let _ = fs::remove_file(&backup_db);

    db::write_meta(&app, &new_meta)?;
    state.set_key(new_key)?;

    // Biometric wrap was for the old key — force re-enroll.
    let hello = db::vault_dir(&app)?.join(BIOMETRIC_KEY_FILE);
    if hello.exists() {
        let _ = fs::remove_file(hello);
    }
    Ok(())
}

#[tauri::command]
pub fn destroy_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    master_password: String,
) -> Result<()> {
    if !db::vault_exists(&app)? {
        return Err(AegisError::VaultMissing);
    }

    let mut master_password = master_password;
    let meta = db::read_meta(&app)?;
    let mut salt = meta.salt()?;
    let key = derive_key(&master_password, &salt, &meta.kdf)?;
    master_password.zeroize();
    salt.zeroize();

    let conn = db::open_encrypted(&app, &key).map_err(|_| AegisError::InvalidMasterPassword)?;
    let verifier = db::verifier(&conn).map_err(|_| AegisError::InvalidMasterPassword)?;
    let plaintext = decrypt(&key, &verifier).map_err(|_| AegisError::InvalidMasterPassword)?;
    if !constant_time_eq(&plaintext, VERIFIER) {
        return Err(AegisError::InvalidMasterPassword);
    }
    drop(conn);

    state.lock();
    db::remove_vault_files(&app)?;
    let hello = db::vault_dir(&app)?.join(BIOMETRIC_KEY_FILE);
    if hello.exists() {
        let _ = fs::remove_file(hello);
    }
    let blobs = db::vault_dir(&app)?.join("blobs");
    if blobs.exists() {
        let _ = fs::remove_dir_all(blobs);
    }
    Ok(())
}

fn validate_master_password(master_password: &str) -> Result<()> {
    if master_password.len() < 12 {
        return Err(AegisError::InvalidInput(
            "master password must be at least 12 characters".to_string(),
        ));
    }
    Ok(())
}
