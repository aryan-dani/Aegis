import type { VaultEntry } from "@/types";

const now = "2026-08-01T12:00:00.000Z";

export const DEMO_ENTRIES: VaultEntry[] = [
  {
    kind: "password",
    id: "pw-github",
    title: "GitHub",
    url: "https://github.com",
    username: "dev@example.com",
    password: "demo-not-real",
    notes: "Personal repos and CI tokens.",
    folder: "Dev",
    tags: ["work", "2fa"],
    created_at: now,
    updated_at: now,
    filename: "",
    mime_type: "",
    size_bytes: 0,
  },
  {
    kind: "password",
    id: "pw-bank",
    title: "Demo Bank",
    url: "https://example.com",
    username: "demo.user",
    password: "demo-not-real",
    notes: "Marketing demo entry only.",
    folder: "Personal",
    tags: ["finance"],
    created_at: now,
    updated_at: now,
    filename: "",
    mime_type: "",
    size_bytes: 0,
  },
  {
    kind: "password",
    id: "pw-email",
    title: "Fastmail",
    url: "https://fastmail.com",
    username: "hello@example.com",
    password: "demo-not-real",
    notes: "",
    folder: "Personal",
    tags: [],
    created_at: now,
    updated_at: now,
    filename: "",
    mime_type: "",
    size_bytes: 0,
  },
  {
    kind: "document",
    id: "doc-passport",
    title: "Passport Scan",
    url: "",
    username: "",
    password: "",
    notes: "Encrypted identity document blob.",
    folder: "Identity",
    tags: ["id", "travel"],
    created_at: now,
    updated_at: now,
    filename: "passport-scan.pdf",
    mime_type: "application/pdf",
    size_bytes: 245_760,
  },
];

export const DEMO_FOLDERS = ["Dev", "Personal", "Identity"];
export const DEMO_TAGS = ["work", "2fa", "finance", "id", "travel"];

export const DEMO_ENTRY_DRAFT = {
  url: "https://example.com",
  username: "demo.user",
  password: "GeneratedPass123!",
  notes: "Demo entry for marketing screenshot.",
  folder: "Personal",
  tags: ["demo"],
};

export function findDemoDocument() {
  return DEMO_ENTRIES.find((entry) => entry.kind === "document") ?? null;
}
