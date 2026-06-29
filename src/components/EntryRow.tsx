import { useState } from "react";
import { Check, Copy, Pencil, Trash2, User } from "lucide-react";
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
import { entryInitials, entryLabel } from "@/lib/format";
import type { VaultEntry } from "@/types";

type EntryRowProps = {
  entry: VaultEntry;
  index: number;
  onDelete: () => Promise<void>;
  onEdit: () => void;
};

export function EntryRow({ entry, index, onDelete, onEdit }: EntryRowProps) {
  const [copied, setCopied] = useState<"password" | "username" | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function copy(kind: "password" | "username") {
    const value = kind === "password" ? entry.password : entry.username;
    if (!value) return;
    await api.copySecret(value);
    setCopied(kind);
    toast.success(`${kind === "password" ? "Password" : "Username"} copied`, {
      description: "Clipboard clears in 30 seconds.",
    });
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
  }

  return (
    <div
      className="group flex items-center gap-3 rounded-xl border bg-card/60 p-3 transition-all duration-200 hover:border-foreground/25 hover:bg-card animate-in fade-in-0 slide-in-from-bottom-1"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={onEdit}
        type="button"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background font-mono text-xs font-semibold text-muted-foreground">
          {entryInitials(entry)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{entryLabel(entry)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {entry.username || "No username"}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {entry.folder ? (
          <Badge className="hidden md:inline-flex" variant="outline">
            {entry.folder}
          </Badge>
        ) : null}
        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          {entry.username ? (
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
          <Button
            aria-label="Copy password"
            size="icon-sm"
            title="Copy password"
            variant="ghost"
            onClick={() => copy("password")}
          >
            {copied === "password" ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button
            aria-label="Edit entry"
            size="icon-sm"
            title="Edit"
            variant="ghost"
            onClick={onEdit}
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
                <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
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
