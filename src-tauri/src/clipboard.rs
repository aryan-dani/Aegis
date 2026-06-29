use std::time::Duration;

use tauri::{AppHandle, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use zeroize::Zeroizing;

use crate::{crypto::constant_time_eq, error::Result, keystore::AppState};

#[tauri::command]
pub fn copy_secret(app: AppHandle, state: State<'_, AppState>, text: String) -> Result<()> {
    let _ = state.key_copy()?;
    let secret = Zeroizing::new(text);

    app.clipboard()
        .write_text(secret.to_string())
        .map_err(|_| crate::error::AegisError::Filesystem)?;

    let expected = secret.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(30)).await;
        if let Ok(current) = app.clipboard().read_text() {
            // Use constant-time comparison so that the clipboard-clear check
            // does not leak information about the secret through timing.
            if constant_time_eq(current.as_bytes(), expected.as_bytes()) {
                let _ = app.clipboard().clear();
            }
        }
    });
    Ok(())
}
