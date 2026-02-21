// lib/security.ts
import crypto from "crypto";

/**
 * Hash a 4-digit PIN using server-side salt
 * Output: sha256 hex (64 chars)
 */
export function hashPin(pin: string): string {
  const salt = process.env.PIN_SALT ?? "";
  return crypto
    .createHash("sha256")
    .update(`${pin}:${salt}`)
    .digest("hex");
}

/**
 * Verify a plain PIN against a stored hash (hex)
 * ✅ Uses timingSafeEqual with equal-length buffers
 * ✅ Decodes hex correctly (NOT utf8)
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;

  const computedHex = hashPin(String(pin).trim());

  // sha256 hex should be 64 chars; but we just enforce equality
  if (computedHex.length !== String(storedHash).length) return false;

  try {
    const a = Buffer.from(computedHex, "hex");
    const b = Buffer.from(String(storedHash), "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time compare for secrets (string)
 * ✅ Avoids "Input buffers must have the same byte length"
 */
function safeEqualString(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/**
 * Require ADMIN_SECRET (throws on failure)
 * Reads x-admin-secret (or Authorization: Bearer <secret>)
 */
export function requireAdminSecret(req: Request) {
  const expected = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!expected) throw new Error("ADMIN_SECRET not configured");

  const header =
    req.headers.get("x-admin-secret") ||
    req.headers.get("X-Admin-Secret") ||
    "";

  const auth = req.headers.get("authorization") || "";
  let provided = String(header ?? "").trim();

  // Allow: Authorization: Bearer <secret>
  if (!provided && auth.toLowerCase().startsWith("bearer ")) {
    provided = auth.slice(7).trim();
  }

  if (!provided) throw new Error("Missing admin secret");

  // ✅ constant-time compare + length safe
  if (!safeEqualString(provided, expected)) {
    throw new Error("Invalid admin secret");
  }
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
