import crypto from "crypto";

/**
 * Hash a 4-digit PIN using server-side salt
 */
export function hashPin(pin: string): string {
  const salt = process.env.PIN_SALT ?? "";
  return crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex"); // ✅ hex string
}

/**
 * Verify a plain PIN against a stored hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;

  const computedHex = hashPin(pin);

  // ✅ Both are hex strings → compare as hex buffers (not utf8)
  let a: Buffer;
  let b: Buffer;

  try {
    a = Buffer.from(computedHex, "hex");
    b = Buffer.from(String(storedHash).trim(), "hex");
  } catch {
    return false;
  }

  // ✅ timingSafeEqual requires same length
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
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
