/**
 * Client address for per-IP limits. Behind N reverse proxies that each append
 * to X-Forwarded-For, the client is the N-th entry from the right; anything
 * further left is client-supplied and cannot be trusted.
 * `TRUSTED_PROXY_HOPS` unset or 0 disables per-IP limits.
 */
export function clientIp(headers: Headers): string | null {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  if (!Number.isFinite(hops) || hops <= 0) return null;

  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? null;
}
