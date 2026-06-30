import { Toaster as Sonner } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      closeButton
      expand
      gap={10}
      visibleToasts={4}
      icons={{
        success: <CheckCircle2 className="size-4" />,
        error: <XCircle className="size-4" />,
        info: <Info className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast aegis-toast !rounded-2xl !border !border-white/12 !bg-zinc-950/90 !px-4 !py-3 !text-foreground !shadow-[0_22px_80px_rgba(0,0,0,0.55)] !backdrop-blur-xl",
          title: "!text-sm !font-medium !tracking-tight",
          description: "!mt-1 !text-xs !leading-relaxed !text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-secondary !text-secondary-foreground",
          closeButton:
            "!top-3 !right-3 !border-white/10 !bg-white/5 !text-muted-foreground hover:!bg-white/10 hover:!text-foreground",
        },
      }}
    />
  );
}
