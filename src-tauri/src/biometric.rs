use std::{fs, path::PathBuf, sync::mpsc, thread};

use tauri::{AppHandle, State};
use zeroize::Zeroizing;

use crate::{
    crypto::{constant_time_eq, decrypt, VaultKey},
    db,
    error::{AegisError, Result},
    keystore::AppState,
};

const BIOMETRIC_KEY_FILE: &str = "windows-hello.key";
const VERIFIER: &[u8] = b"aegis-vault-verifier-v1";

#[derive(Debug, Clone, serde::Serialize)]
pub struct BiometricStatus {
    pub available: bool,
    pub enrolled: bool,
    pub message: String,
}

#[tauri::command]
pub fn biometric_status(app: AppHandle) -> Result<BiometricStatus> {
    let mut status = platform_biometric_status()?;
    status.enrolled = biometric_key_path(&app)?.exists();
    Ok(status)
}

#[tauri::command]
pub fn enroll_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let _ = state.key_copy()?;
    platform_verify_user_presence("Enable Windows Hello unlock for Aegis")?;

    let key = Zeroizing::new(state.key_copy()?);
    let protected = platform_protect_key(&key)?;
    fs::write(biometric_key_path(&app)?, protected)?;
    Ok(())
}

#[tauri::command]
pub fn biometric_unlock(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.ensure_not_locked_out()?;
    platform_verify_user_presence("Unlock Aegis with Windows Hello")?;

    let path = biometric_key_path(&app)?;
    if !path.exists() {
        return Err(AegisError::BiometricNotEnrolled);
    }

    let protected = fs::read(path)?;
    let key = match platform_unprotect_key(&protected) {
        Ok(key) => key,
        Err(error) => {
            state.record_failed_unlock();
            return Err(error);
        }
    };

    let unlock_result = (|| -> Result<()> {
        let conn = db::open_encrypted(&app, &key).map_err(|_| AegisError::InvalidMasterPassword)?;
        let verifier = db::verifier(&conn).map_err(|_| AegisError::InvalidMasterPassword)?;
        let plaintext = decrypt(&key, &verifier).map_err(|_| AegisError::InvalidMasterPassword)?;
        if !constant_time_eq(&plaintext, VERIFIER) {
            return Err(AegisError::InvalidMasterPassword);
        }
        db::migrate(&conn)?;
        Ok(())
    })();

    match unlock_result {
        Ok(()) => state.set_key(key),
        Err(AegisError::InvalidMasterPassword) => {
            state.record_failed_unlock();
            Err(AegisError::InvalidMasterPassword)
        }
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn disable_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let _ = state.key_copy()?;
    platform_verify_user_presence("Disable Windows Hello unlock for Aegis")?;

    let path = biometric_key_path(&app)?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn biometric_key_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(db::vault_dir(app)?.join(BIOMETRIC_KEY_FILE))
}

#[cfg(windows)]
fn platform_verify_user_presence(message: &str) -> Result<()> {
    let (tx, rx) = mpsc::sync_channel(1);
    let message = message.to_string();

    thread::spawn(move || {
        let result = request_user_consent(&message);
        let _ = tx.send(result);
    });

    rx.recv().map_err(|_| AegisError::BiometricBusy)?
}

#[cfg(windows)]
fn request_user_consent(message: &str) -> Result<()> {
    use windows::{
        core::HSTRING,
        Security::Credentials::UI::{
            UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
        },
        Win32::System::WinRT::{RoInitialize, RO_INIT_SINGLETHREADED},
    };

    unsafe {
        let _ = RoInitialize(RO_INIT_SINGLETHREADED);
    }

    let availability = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(|_| AegisError::BiometricUnavailable)?
        .get()
        .map_err(|_| AegisError::BiometricUnavailable)?;

    if availability != UserConsentVerifierAvailability::Available {
        return Err(AegisError::BiometricUnavailable);
    }

    let result = UserConsentVerifier::RequestVerificationAsync(&HSTRING::from(message))
        .map_err(|_| AegisError::BiometricBusy)?
        .get()
        .map_err(|_| AegisError::BiometricBusy)?;

    match result {
        UserConsentVerificationResult::Verified => Ok(()),
        UserConsentVerificationResult::Canceled => Err(AegisError::BiometricCancelled),
        _ => Err(AegisError::BiometricBusy),
    }
}

#[cfg(windows)]
fn platform_biometric_status() -> Result<BiometricStatus> {
    use windows::{
        Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability},
        Win32::System::WinRT::{RoInitialize, RO_INIT_SINGLETHREADED},
    };

    unsafe {
        let _ = RoInitialize(RO_INIT_SINGLETHREADED);
    }

    let available = UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.get())
        .map(|a| a == UserConsentVerifierAvailability::Available)
        .unwrap_or(false);

    let message = if available {
        "Windows Hello is verified by the operating system before key release."
    } else {
        "Windows Hello is not configured on this device. Set it up in Windows Settings."
    }
    .to_string();

    Ok(BiometricStatus {
        available,
        enrolled: false,
        message,
    })
}

#[cfg(windows)]
fn platform_protect_key(key: &[u8; 32]) -> Result<Vec<u8>> {
    use std::ptr::null_mut;
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::{LocalFree, HLOCAL},
            Security::Cryptography::{
                CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
            },
        },
    };

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: key.len() as u32,
        pbData: key.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    unsafe {
        CryptProtectData(
            &mut input,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|_| AegisError::Crypto)?;

        let protected = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut _)));
        Ok(protected)
    }
}

#[cfg(windows)]
fn platform_unprotect_key(protected: &[u8]) -> Result<VaultKey> {
    use std::ptr::null_mut;
    use windows::Win32::{
        Foundation::{LocalFree, HLOCAL},
        Security::Cryptography::{
            CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: protected.len() as u32,
        pbData: protected.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    unsafe {
        CryptUnprotectData(
            &mut input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|_| AegisError::Crypto)?;

        if output.cbData as usize != 32 {
            let _ = LocalFree(Some(HLOCAL(output.pbData as *mut _)));
            return Err(AegisError::Crypto);
        }
        let mut key = Zeroizing::new([0u8; 32]);
        key.copy_from_slice(std::slice::from_raw_parts(output.pbData, 32));
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut _)));
        Ok(key)
    }
}

#[cfg(not(windows))]
fn platform_verify_user_presence(_message: &str) -> Result<()> {
    Err(AegisError::BiometricUnavailable)
}

#[cfg(not(windows))]
fn platform_biometric_status() -> Result<BiometricStatus> {
    Ok(BiometricStatus {
        available: false,
        enrolled: false,
        message: "Biometric unlock is only available on Windows in this build.".to_string(),
    })
}

#[cfg(not(windows))]
fn platform_protect_key(_key: &[u8; 32]) -> Result<Vec<u8>> {
    Err(AegisError::BiometricUnavailable)
}

#[cfg(not(windows))]
fn platform_unprotect_key(_protected: &[u8]) -> Result<VaultKey> {
    Err(AegisError::BiometricUnavailable)
}
