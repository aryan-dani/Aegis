import { useState } from "react";
import { Check, Copy, ExternalLink, FileText, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/ipc";
import { entryInitials, entryLabel, formatBytes, mimeLabel } from "@/lib/format";
import { isDocument } from "@/store/vaultStore";
import type { VaultEntry } from "@/types";

type EntryRowProps = {
  entry: VaultEntry;
  onDelete: () => Promise<void>;
  onOpen: () => void;
};

function httpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function EntryRow({ entry, onDelete, onOpen }: EntryRowProps) {
  const document = isDocument(entry);
  const [copied, setCopied] = useState<"password" | "username" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const siteUrl = !document ? httpUrl(entry.url) : null;

  async function copy(kind: "password" | "username") {
    const value = kind === "password" ? entry.password : entry.username;
    if (!value) {
      toast.error(kind === "password" ? "No password to copy" : "No username to copy");
      return;
    }
    await api.copySecret(value);
    setCopied(kind);
    toast.success(`${kind === "password" ? "Password" : "Username"} copied`, {
      description: "Clipboard clears in 30 seconds.",
    });
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
  }

  async function openSite() {
    if (!siteUrl) {
      toast.error("No valid URL to open");
      return;
    }
    try {
      await api.openExternalUrl(siteUrl);
    } catch (cause) {
      toast.error("Could not open URL", { description: String(cause) });
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-2xl border bg-card/60 p-3 transition-colors hover:border-foreground/20 hover:bg-card/90">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={onOpen}
        type="button"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/80 font-mono text-xs font-semibold text-muted-foreground">
          {document ? <FileText className="size-4" /> : entryInitials(entry)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{entryLabel(entry)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {document
              ? `${mimeLabel(entry.mime_type)} · ${formatBytes(entry.size_bytes)}`
              : entry.username || "No username"}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <Badge className="hidden capitalize sm:inline-flex" variant="outline">
          {document ? "Document" : "Password"}
        </Badge>
        {entry.folder ? (
          <Badge className="hidden max-w-[9rem] truncate md:inline-flex" variant="secondary">
            {entry.folder}
          </Badge>
        ) : null}
        <div className="flex items-center gap-0.5">
          {siteUrl ? (
            <Button
              aria-label="Open website"
              size="icon-sm"
              title="Open website"
              variant="ghost"
              onClick={openSite}
            >
              <ExternalLink className="size-4" />
            </Button>
          ) : null}
          {!document && entry.username ? (
            <Button
              aria-label="Copy username"
              size="icon-sm"
              title="Copy username"
              variant="ghost"
              onClick={() => copy("username")}
            >
              {copied === "username" ? <Check className="size-4" /> : <User className="size-4" />}
            </Button>
          ) : null}
          {!document ? (
            <Button
              aria-label="Copy password"
              size="icon-sm"
              title="Copy password"
              variant="ghost"
              onClick={() => copy("password")}
            >
              {copied === "password" ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          ) : null}
          <Button
            aria-label={document ? "Open document" : "Edit entry"}
            size="icon-sm"
            title={document ? "Open" : "Edit"}
            variant="ghost"
            onClick={onOpen}
          >
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button aria-label="Delete entry" size="icon-sm" title="Delete" variant="ghost">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-border bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete this {document ? "document" : "credential"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {entryLabel(entry)} will be permanently removed from the vault. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={async (event) => {
                    event.preventDefault();
                    setDeleting(true);
                    try {
                      await onDelete();
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? <Spinner /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
