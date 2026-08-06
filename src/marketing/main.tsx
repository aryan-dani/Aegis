import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EntryDialog } from "@/components/EntryDialog";
import { AuthScreen } from "@/screens/AuthScreen";
import { VaultScreen } from "@/screens/VaultScreen";
import { ArchitectureDiagram } from "@/marketing/ArchitectureDiagram";
import {
  DEMO_ENTRIES,
  DEMO_ENTRY_DRAFT,
  DEMO_FOLDERS,
  DEMO_TAGS,
  findDemoDocument,
} from "@/marketing/demo-data";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { useVaultStore } from "@/store/vaultStore";
import type { VaultNavView } from "@/components/VaultSidebar";
import "../index.css";

document.documentElement.classList.add("dark");

type MarketingScreen =
  | "create"
  | "vault"
  | "entry"
  | "documents"
  | "settings"
  | "architecture";

function seedVaultStore() {
  useVaultStore.setState({
    entries: DEMO_ENTRIES,
    folders: DEMO_FOLDERS,
    tags: DEMO_TAGS,
    loaded: true,
    loading: false,
    error: null,
    skippedCorrupt: 0,
  });
}

function seedAuthUnlocked() {
  useAuthStore.setState({
    initialized: true,
    vaultExists: true,
    unlocked: true,
    error: null,
  });
}

function seedAuthCreate() {
  useAuthStore.setState({
    initialized: true,
    vaultExists: false,
    unlocked: false,
    error: null,
  });
}

function MarketingApp() {
  const screen = (new URLSearchParams(window.location.search).get("screen") ??
    "create") as MarketingScreen;

  useUiStore.setState({ hibpEnabled: false, inactivitySeconds: 300 });

  if (screen === "create") {
    seedAuthCreate();
    return <AuthScreen />;
  }

  if (screen === "architecture") {
    return <ArchitectureDiagram />;
  }

  seedAuthUnlocked();
  seedVaultStore();

  if (screen === "entry") {
    return (
      <div className="aegis-app-bg min-h-screen">
        <VaultScreen
          marketingInitial={{
            view: "passwords",
            entryDialog: true,
            entryDraft: DEMO_ENTRY_DRAFT,
          }}
        />
      </div>
    );
  }

  if (screen === "documents") {
    return (
      <VaultScreen
        marketingInitial={{
          view: "documents",
          documentDialog: true,
          documentEntry: findDemoDocument(),
        }}
      />
    );
  }

  const view: VaultNavView = screen === "settings" ? "settings" : "all";

  return <VaultScreen marketingInitial={{ view }} />;
}

function Root() {
  return (
    <TooltipProvider delayDuration={200}>
      <MarketingApp />
      <Toaster />
    </TooltipProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
