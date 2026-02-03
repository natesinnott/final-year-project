export function isAppAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = process.env.APP_ADMIN_EMAILS ?? "";
  if (!list.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const allowed = list
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(normalized);
}
