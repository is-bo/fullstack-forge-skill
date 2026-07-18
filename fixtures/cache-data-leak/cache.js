// Intentionally flawed: key omits user and tenant scope.
export async function dashboard(userId, tenantId) {
  return (
    redis.get("dashboard") ??
    redis.set("dashboard", await loadPrivateDashboard(userId, tenantId), { ttl: 3600 })
  );
}
