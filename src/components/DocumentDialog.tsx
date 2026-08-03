import { FormEvent, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Download, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/ipc";
import { entryLabel, formatBytes, mimeLabel } from "@/lib/format";
import type { DocumentMetaInput, DocumentPreview, VaultEntry } from "@/types";

type DocumentDialogProps = {
  entry: VaultEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, input: DocumentMetaInput) => Promise<void>;
};

export function DocumentDialog({ entry, open, onOpenChange, onSave }: DocumentDialogProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setTitle(entry.title || entry.filename);
    setNotes(entry.notes || "");
    setFolder(entry.folder || "");
    setTags(entry.tags.join(", "));
    setEditing(false);
    setPreview(null);
    setLoadingPreview(true);
    api
      .getDocumentPreview(entry.id)
      .then(setPreview)
      .catch((cause) => {
        toast.error("Could not decrypt document preview", { description: String(cause) });
      })
      .finally(() => setLoadingPreview(false));
  }, [open, entry]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!entry) return;
    setSaving(true);
    try {
      await onSave(entry.id, {
        title: title.trim() || entry.filename,
        notes,
        folder: folder.trim() || null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setEditing(false);
      toast.success("Document updated");
    } catch (cause) {
      toast.error("Could not update document", { description: String(cause) });
    } finally {
      setSaving(false);
    }
  }

  async function exportFile() {
    if (!entry) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: entry.filename || "document",
        filters: [{ name: "Document", extensions: [extensionOf(entry.filename)] }],
      });
      if (!path) return;
      await api.exportDocument(entry.id, path);
      toast.success("Document exported", {
        description: "Decrypted copy written to the selected location.",
      });
    } catch (cause) {
      toast.error("Export failed", { description: String(cause) });
    } finally {
      setExporting(false);
    }
  }

  if (!entry) return null;

  const isImage = (preview?.mime_type || entry.mime_type).startsWith("image/");
  const dataUrl =
    preview && isImage
      ? `data:${preview.mime_type};base64,${preview.data_base64}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entryLabel(entry)}</DialogTitle>
          <DialogDescription>
            Encrypted in your vault · {mimeLabel(entry.mime_type)} · {formatBytes(entry.size_bytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border bg-background/60">
            {loadingPreview ? (
              <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Decrypting preview
              </div>
            ) : dataUrl ? (
              <img
                alt={entryLabel(entry)}
                className="mx-auto max-h-[420px] w-full object-contain p-4"
                src={dataUrl}
              />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
                <FileText className="size-10" />
                <p className="text-sm">Preview not available for this file type</p>
                <p className="text-xs">{entry.filename}</p>
              </div>
            )}
          </div>

          {editing ? (
            <form className="space-y-4" onSubmit={handleSave}>
              <div className="space-y-2">
                <Label htmlFor="doc-title">Title</Label>
                <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doc-folder">Folder</Label>
                  <Input
                    id="doc-folder"
                    placeholder="Personal Documents"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-tags">Tags</Label>
                  <Input
                    id="doc-tags"
                    placeholder="identity, travel"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-notes">Notes</Label>
                <Textarea
                  id="doc-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button disabled={saving} type="submit">
                  {saving ? <Spinner /> : null}
                  Save metadata
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetaChip label="Filename" value={entry.filename} />
                <MetaChip label="Type" value={mimeLabel(entry.mime_type)} />
                <MetaChip label="Size" value={formatBytes(entry.size_bytes)} />
              </div>
              {entry.notes ? (
                <div className="rounded-xl border bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">
                  {entry.notes}
                </div>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit details
                  </Button>
                </div>
                <Button disabled={exporting} type="button" onClick={exportFile}>
                  {exporting ? <Spinner /> : <Download className="size-4" />}
                  Export decrypted copy
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/50 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function extensionOf(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "*";
}
