import crypto from "crypto";

const PIN_SALT = process.env.PIN_SALT ?? "dev-salt-change-me";

export function hashPin(pin: string): string {
  return crypto.createHmac("sha256", PIN_SALT).update(pin).digest("hex");
}

export function verifyPin(pin: string, pinHash: string): boolean {
  if (!pinHash) return false;
  return hashPin(pin) === pinHash;
}
