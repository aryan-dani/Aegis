type FilterButtonProps = {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
};

export function FilterButton({ active, count, label, onClick }: FilterButtonProps) {
  return (
    <button
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
