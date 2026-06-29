use std::path::{Component, Path, PathBuf};

use crate::error::{AegisError, Result};

pub fn validate_user_file_path(path: &str, must_exist: bool) -> Result<PathBuf> {
    if path.is_empty() || path.bytes().any(|byte| byte == 0) {
        return Err(AegisError::InvalidInput("invalid file path".to_string()));
    }

    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        return Err(AegisError::InvalidInput(
            "file path must be absolute".to_string(),
        ));
    }

    if candidate
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(AegisError::InvalidInput("invalid file path".to_string()));
    }

    let normalized = if must_exist {
        std::fs::canonicalize(&candidate)
            .map_err(|_| AegisError::InvalidInput("backup file was not found".to_string()))?
    } else {
        let parent = candidate
            .parent()
            .ok_or_else(|| AegisError::InvalidInput("invalid file path".to_string()))?;
        let canonical_parent = std::fs::canonicalize(parent).map_err(|_| {
            AegisError::InvalidInput("export destination folder was not found".to_string())
        })?;
        let file_name = candidate
            .file_name()
            .ok_or_else(|| AegisError::InvalidInput("invalid file path".to_string()))?;
        canonical_parent.join(file_name)
    };

    if !is_allowed_user_path(&normalized) {
        return Err(AegisError::InvalidInput(
            "file path is outside allowed user locations".to_string(),
        ));
    }

    Ok(normalized)
}

#[cfg(windows)]
fn is_allowed_user_path(path: &Path) -> bool {
    let blocked_prefixes = [
        std::env::var("SystemRoot")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\Windows")),
        PathBuf::from("C:\\Windows"),
        PathBuf::from("C:\\Program Files"),
        PathBuf::from("C:\\Program Files (x86)"),
    ];

    !blocked_prefixes
        .iter()
        .any(|prefix| path.starts_with(prefix))
}

/// Non-Windows platforms do not have the same system-directory layout.
/// Allow all absolute paths for now; extend with platform-appropriate
/// blocklists when adding macOS or Linux support.
#[cfg(not(windows))]
fn is_allowed_user_path(_path: &Path) -> bool {
    true
}
