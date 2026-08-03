import {
  Clock,
  Database,
  Download,
  Fingerprint,
  Folder,
  FolderOpen,
  Import,
} from "lucide-react";
import { AegisLogo } from "@/components/AegisLogo";
import { UpdatePanel } from "@/components/UpdatePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BiometricStatus } from "@/types";

export type SettingsPanelProps = {
  biometric: BiometricStatus | null;
  helloAvailable: boolean;
  helloBusy: boolean;
  hibpEnabled: boolean;
  setHibpEnabled: (value: boolean) => void;
  inactivitySeconds: number;
  setInactivitySeconds: (value: number) => void;
  updateTimeout: (seconds: number) => Promise<void>;
  enrollBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  exportPassphrase: string;
  setExportPassphrase: (value: string) => void;
  backupPassphrase: string;
  setBackupPassphrase: (value: string) => void;
  exporting: boolean;
  importing: boolean;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  importBitwarden: () => Promise<void>;
  importFolderPicker: () => Promise<void>;
  importPersonalFolder: () => Promise<void>;
};

export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <div className="aegis-panel h-full overflow-auto rounded-none border-0 lg:rounded-[28px] lg:border">
      <div className="border-b bg-background/35 px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Control center
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Security and maintenance</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Manage vault posture, documents, signed updates, Windows Hello, auto-lock, and encrypted
          backups from one workspace.
        </p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-6">
          <UpdatePanel />

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <AegisLogo className="shrink-0" size="sm" />
              <div>
                <Label>Vault posture</Label>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Passwords and documents are encrypted locally with AES-256-GCM before storage.
                  Document binaries live in encrypted blob files beside the SQLCipher database.
                  Aegis does not sync vault content or send telemetry.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Storage</p>
                <p className="mt-1 text-sm font-medium">SQLCipher + encrypted blobs</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Encryption</p>
                <p className="mt-1 text-sm font-medium">AES-256-GCM</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-4">
                <p className="text-xs text-muted-foreground">Network</p>
                <p className="mt-1 text-sm font-medium">Manual and opt-in</p>
              </div>
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                  <Database className="size-5" />
                </div>
                <div>
                  <Label>HIBP breach checks</Label>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Optional online check. Aegis sends only the first five SHA-1 characters of the
                    password hash; the full password never leaves the device.
                  </p>
                </div>
              </div>
              <Switch checked={props.hibpEnabled} onCheckedChange={props.setHibpEnabled} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                <Clock className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="timeout">Auto-lock timeout</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Lock the vault after inactivity. Shorter values reduce exposure on shared machines.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Input
                    className="max-w-40"
                    id="timeout"
                    min={30}
                    type="number"
                    value={props.inactivitySeconds}
                    onBlur={(event) => props.updateTimeout(Number(event.target.value))}
                    onChange={(event) => props.setInactivitySeconds(Number(event.target.value))}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-card">
                <Fingerprint className="size-5" />
              </div>
              <div>
                <Label>Windows Hello unlock</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Convenience unlock for this Windows profile. The vault key is protected with
                  Windows DPAPI after an operating-system verification.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Current status</p>
              <p className="mt-1 text-sm font-medium">
                {props.helloAvailable
                  ? props.biometric?.enrolled
                    ? "Enabled for this vault"
                    : "Available, not yet enabled"
                  : "Not available in this window"}
              </p>
            </div>
            <div className="mt-4">
              {props.biometric?.enrolled ? (
                <Button
                  className="w-full"
                  disabled={props.helloBusy}
                  variant="destructive"
                  onClick={props.disableBiometric}
                >
                  {props.helloBusy ? <Spinner /> : null}
                  Disable Windows Hello
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={!props.helloAvailable || props.helloBusy}
                  onClick={props.enrollBiometric}
                >
                  {props.helloBusy ? <Spinner /> : <Fingerprint className="size-4" />}
                  Enable Windows Hello
                </Button>
              )}
            </div>
          </div>

          <div className="aegis-glass rounded-2xl p-5">
            <div>
              <Label>Data portability</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Export encrypted backups for passwords and documents, restore backups, migrate
                Bitwarden CSV, or import document folders.
              </p>
            </div>

            <Tabs defaultValue="export" className="mt-5">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="export">Export</TabsTrigger>
                <TabsTrigger value="backup">Restore</TabsTrigger>
                <TabsTrigger value="csv">CSV</TabsTrigger>
                <TabsTrigger value="docs">Docs</TabsTrigger>
              </TabsList>
              <TabsContent value="export" className="space-y-3 pt-4">
                <Input
                  type="password"
                  value={props.exportPassphrase}
                  onChange={(event) => props.setExportPassphrase(event.target.value)}
                  placeholder="Export passphrase (min 12 chars)"
                />
                <Button
                  className="w-full"
                  disabled={props.exportPassphrase.length < 12 || props.exporting}
                  onClick={props.exportBackup}
                >
                  {props.exporting ? <Spinner /> : <Download className="size-4" />}
                  Export encrypted backup
                </Button>
              </TabsContent>
              <TabsContent value="backup" className="space-y-3 pt-4">
                <Input
                  type="password"
                  value={props.backupPassphrase}
                  onChange={(event) => props.setBackupPassphrase(event.target.value)}
                  placeholder="Backup passphrase"
                />
                <Button
                  className="w-full"
                  disabled={props.backupPassphrase.length < 12 || props.importing}
                  onClick={props.importBackup}
                >
                  {props.importing ? <Spinner /> : <Import className="size-4" />}
                  Restore from backup
                </Button>
              </TabsContent>
              <TabsContent value="csv" className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  disabled={props.importing}
                  variant="secondary"
                  onClick={props.importBitwarden}
                >
                  {props.importing ? <Spinner /> : <Import className="size-4" />}
                  Import Bitwarden CSV
                </Button>
              </TabsContent>
              <TabsContent value="docs" className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  disabled={props.importing}
                  onClick={props.importPersonalFolder}
                >
                  {props.importing ? <Spinner /> : <FolderOpen className="size-4" />}
                  Import Personal Documents
                </Button>
                <Button
                  className="w-full"
                  disabled={props.importing}
                  variant="secondary"
                  onClick={props.importFolderPicker}
                >
                  {props.importing ? <Spinner /> : <Folder className="size-4" />}
                  Choose folder to import
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
