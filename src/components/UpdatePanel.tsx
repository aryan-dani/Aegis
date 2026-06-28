import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { CheckCircle2, DownloadCloud, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { checkForUpdate, installUpdate, type Update } from "@/lib/updater";

export function UpdatePanel() {
  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [available, setAvailable] = useState<Update | null>(null);
  const [checked, setChecked] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => undefined);
  }, []);

  async function onCheck() {
    setChecking(true);
    setChecked(false);
    try {
      const update = await checkForUpdate();
      if (update) {
        setAvailable(update);
        toast.info(`Aegis v${update.version} is available`);
      } else {
        setAvailable(null);
        setChecked(true);
        toast.success("Aegis is up to date");
      }
    } catch (cause) {
      toast.error("Update check failed", {
        description:
          "Confirm the GitHub release is public and latest.json is available, then try again.",
      });
      console.error(cause);
    } finally {
      setChecking(false);
    }
  }

  async function onInstall() {
    if (!available) return;
    setInstalling(true);
    setPct(0);
    try {
      await installUpdate(available, (downloaded, total) => {
        if (total) {
          setPct(Math.min(100, Math.round((downloaded / total) * 100)));
        }
      });
      // The app relaunches automatically once the installer finishes.
    } catch (cause) {
      toast.error("Update failed", { description: String(cause) });
      setInstalling(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-card">
          <DownloadCloud className="size-4 text-foreground" />
        </div>
        <div className="space-y-1">
          <Label>Software updates</Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aegis checks the public GitHub release manifest only when you ask. Installers are
            signed and verified before installation.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border bg-card px-3 py-2">
          <p className="text-muted-foreground">Installed version</p>
          <p className="mt-1 font-mono text-foreground">v{version || "..."}</p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2">
          <p className="text-muted-foreground">Verification</p>
          <p className="mt-1 flex items-center gap-1.5 text-foreground">
            <ShieldCheck className="size-3.5" />
            Signed artifacts
          </p>
        </div>
      </div>

      {available ? (
        <div className="mt-4 space-y-3 rounded-xl border bg-card p-3">
          <p className="text-sm font-medium">
            Version <span className="font-mono">v{available.version}</span> is ready to install.
          </p>
          {available.body ? (
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
              {available.body}
            </p>
          ) : null}
          {installing ? <Progress value={pct} /> : null}
          <Button className="w-full" disabled={installing} onClick={onInstall}>
            {installing ? <Spinner /> : <DownloadCloud className="size-4" />}
            {installing ? `Installing ${pct}%` : "Download, verify, and restart"}
          </Button>
        </div>
      ) : (
        <>
          {checked ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 text-foreground" />
              <p>Aegis is already running the newest signed release available to this channel.</p>
            </div>
          ) : null}
          <Button
            className="mt-4 w-full"
            disabled={checking}
            variant="secondary"
            onClick={onCheck}
          >
            {checking ? <Spinner /> : <RefreshCw className="size-4" />}
            {checking ? "Checking release channel" : "Check for updates"}
          </Button>
        </>
      )}
    </div>
  );
}
