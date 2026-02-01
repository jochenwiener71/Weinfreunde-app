import crypto from "crypto";

/**
 * 🔐 Hash für 4-stellige PIN
 * wird in Firestore gespeichert (nie die Klar-PIN!)
 */
export function hashPin(pin: string): string {
  const salt = process.env.PIN_SALT || "default_salt";
  return crypto.createHash("sha256").update(pin + salt).digest("hex");
}

/**
 * Liest das Admin-Secret aus dem Request
 * - Header: x-admin-secret
 * - oder Authorization: Bearer <secret>
 */
export function getAdminSecret(req: Request): string | null {
  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret");

  if (header && header.trim()) return header.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  return null;
}

/**
 * ❗ Erzwingt korrektes ADMIN_SECRET
 * → für Admin-Endpoints
 */
export function requireAdminSecret(req: Request): string {
  const provided = getAdminSecret(req);
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    throw new Error("ADMIN_SECRET not configured");
  }

  if (!provided || provided !== expected) {
    throw new Error("Invalid ADMIN_SECRET");
  }

  return provided;
}
