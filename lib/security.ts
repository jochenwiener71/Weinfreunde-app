import crypto from "crypto";

/**
 * Hash a 4-digit PIN using server-side salt
 */
export function hashPin(pin: string): string {
  const salt = process.env.PIN_SALT ?? "";
  return crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex");
}

/**
 * Verify a plain PIN against a stored hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  const computed = hashPin(pin);
  return crypto.timingSafeEqual(
    Buffer.from(computed, "utf8"),
    Buffer.from(storedHash, "utf8")
  );
}

/**
 * Require ADMIN_SECRET (throws on failure)
 */
export function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) {
    throw new Error("ADMIN_SECRET not configured");
  }

  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  const auth = req.headers.get("authorization") || "";
  let provided = header;

  if (!provided && auth.toLowerCase().startsWith("bearer ")) {
    provided = auth.slice(7).trim();
  }

  if (!provided || provided !== expected) {
    throw new Error("Forbidden");
  }
}
