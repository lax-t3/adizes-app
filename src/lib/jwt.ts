// src/lib/jwt.ts

/**
 * Decode the payload of a JWT without signature verification.
 * Returns {} on any parse error — never throws.
 */
export function decodeJwt(token: string): Record<string, any> {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}
