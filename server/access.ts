export type Identity = { userId: string; email: string; displayName: string };
export function isAllowed(
  user: Identity | null,
  configuration: string | undefined,
): user is Identity {
  if (!user?.userId || !user.email || !configuration?.trim()) return false;
  const allowed = new Set(
    configuration
      .split(/[,\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(user.email.trim().toLowerCase());
}
