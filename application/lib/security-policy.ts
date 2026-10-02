export type Role = "owner" | "admin" | "editor" | "viewer";

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ["read","write","approve","manage_roles","manage_security","manage_vault"],
  admin: ["read","write","approve","manage_security","manage_vault"],
  editor: ["read","write"],
  viewer: ["read"],
};

export function roleCan(role: Role, permission: string) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function safeVaultMetadata(input: {
  category: string;
  service: string;
  username_hint?: string | null;
  secret_reference?: string | null;
  url?: string | null;
  notes?: string | null;
}) {
  return {
    ...input,
    secret_reference: input.secret_reference ?? null,
  };
}

export function containsPlaintextSecretField(record: Record<string, unknown>) {
  return ["password","secret","api_key","token","private_key"].some((key) => key in record);
}
