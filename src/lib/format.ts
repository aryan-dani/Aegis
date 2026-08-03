import type { VaultEntry } from "@/types";
import { isDocument } from "@/store/vaultStore";

export function entryLabel(entry: VaultEntry): string {
  if (isDocument(entry)) {
    return entry.title.trim() || entry.filename.trim() || "Untitled document";
  }
  const url = entry.url.trim();
  if (url) {
    return url
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "");
  }
  return entry.username.trim() || "Untitled credential";
}

export function entryInitials(entry: VaultEntry): string {
  const label = entryLabel(entry);
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, " ").trim();
  if (!cleaned) {
    return "?";
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function mimeLabel(mime: string): string {
  if (!mime) return "File";
  if (mime.startsWith("image/")) return "Image";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("text/")) return "Text";
  return mime.split("/").pop()?.toUpperCase() || "File";
}
