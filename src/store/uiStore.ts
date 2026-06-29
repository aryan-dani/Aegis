import { create } from "zustand";

const HIBP_KEY = "aegis.ui.hibpEnabled";
const TIMEOUT_KEY = "aegis.ui.inactivitySeconds";

const DEFAULT_INACTIVITY = 300;
const MIN_INACTIVITY = 30;

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === "true";
}

function readInt(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(MIN_INACTIVITY, n) : fallback;
}

function normalizeInactivity(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(MIN_INACTIVITY, Math.floor(seconds)) : DEFAULT_INACTIVITY;
}

type UiState = {
  hibpEnabled: boolean;
  inactivitySeconds: number;
  setHibpEnabled: (enabled: boolean) => void;
  setInactivitySeconds: (seconds: number) => void;
};

export const useUiStore = create<UiState>((set) => ({
  hibpEnabled: readBool(HIBP_KEY, false),
  inactivitySeconds: readInt(TIMEOUT_KEY, DEFAULT_INACTIVITY),
  setHibpEnabled: (hibpEnabled) => {
    localStorage.setItem(HIBP_KEY, String(hibpEnabled));
    set({ hibpEnabled });
  },
  setInactivitySeconds: (seconds) => {
    const inactivitySeconds = normalizeInactivity(seconds);
    localStorage.setItem(TIMEOUT_KEY, String(inactivitySeconds));
    set({ inactivitySeconds });
  },
}));
