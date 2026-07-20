export interface UserProfile {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRow {
  id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

export function validateHandle(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^[a-z0-9_]{3,24}$/.test(value)) return "Use 3–24 lowercase letters, numbers, or underscores.";
  return undefined;
}

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
