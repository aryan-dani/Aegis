import type { ReactNode } from "react";
import {
  FileText,
  Folder,
  KeyRound,
  LayoutGrid,
  Lock,
  Settings,
  Tag,
} from "lucide-react";
import { AegisLogo } from "@/components/AegisLogo";
import { FilterButton } from "@/components/FilterButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type VaultNavView = "all" | "passwords" | "documents" | "settings";

type VaultSidebarProps = {
  view: VaultNavView;
  onViewChange: (view: VaultNavView) => void;
  totalCount: number;
  passwordCount: number;
  documentCount: number;
  folders: string[];
  folderCounts: Record<string, number>;
  folderFilter: string | null;
  onFolderSelect: (folder: string | null) => void;
  tags: string[];
  tagFilter: string | null;
  onTagSelect: (tag: string | null) => void;
  onLock: () => void;
};

export function VaultSidebar({
  view,
  onViewChange,
  totalCount,
  passwordCount,
  documentCount,
  folders,
  folderCounts,
  folderFilter,
  onFolderSelect,
  tags,
  tagFilter,
  onTagSelect,
  onLock,
}: VaultSidebarProps) {
  const showFacets = view !== "settings";

  return (
    <aside className="aegis-panel flex h-[100dvh] w-[260px] shrink-0 flex-col rounded-none border-y-0 border-l-0 lg:rounded-[28px] lg:border">
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <AegisLogo size="sm" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Local vault
          </p>
          <h1 className="text-base font-semibold tracking-tight">Aegis</h1>
        </div>
      </div>

      <nav className="space-y-1 px-2">
        <NavButton
          active={view === "all"}
          count={totalCount}
          icon={<LayoutGrid className="size-4" />}
          label="All items"
          onClick={() => onViewChange("all")}
        />
        <NavButton
          active={view === "passwords"}
          count={passwordCount}
          icon={<KeyRound className="size-4" />}
          label="Passwords"
          onClick={() => onViewChange("passwords")}
        />
        <NavButton
          active={view === "documents"}
          count={documentCount}
          icon={<FileText className="size-4" />}
          label="Documents"
          onClick={() => onViewChange("documents")}
        />
        <NavButton
          active={view === "settings"}
          icon={<Settings className="size-4" />}
          label="Settings"
          onClick={() => onViewChange("settings")}
        />
      </nav>

      {showFacets ? (
        <ScrollArea className="mt-6 min-h-0 flex-1 px-2">
          <div className="pb-4">
            <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Folder className="size-3.5" />
              Folders
            </p>
            <div className="space-y-1">
              <FilterButton
                active={!folderFilter}
                count={totalCount}
                label="All folders"
                onClick={() => onFolderSelect(null)}
              />
              {folders.map((folder) => (
                <FilterButton
                  active={folderFilter === folder}
                  count={folderCounts[folder] ?? 0}
                  key={folder}
                  label={folder}
                  onClick={() => onFolderSelect(folderFilter === folder ? null : folder)}
                />
              ))}
              {!folders.length ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet</p>
              ) : null}
            </div>

            {tags.length ? (
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <Tag className="size-3.5" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {tags.map((tag) => (
                    <Badge
                      className="cursor-pointer"
                      key={tag}
                      variant={tagFilter === tag ? "default" : "secondary"}
                      onClick={() => onTagSelect(tagFilter === tag ? null : tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      ) : (
        <div className="mt-6 flex-1 px-4">
          <p className="rounded-2xl border bg-background/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            Folder and tag filters are available in the vault views. Use All, Passwords, or Documents
            to return to your items.
          </p>
        </div>
      )}

      <div className="p-3">
        <Button className="w-full" variant="outline" onClick={onLock}>
          <Lock className="size-4" />
          Lock vault
        </Button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      {typeof count === "number" ? (
        <span className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
