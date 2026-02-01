import admin from "firebase-admin";

let _db: admin.firestore.Firestore | null = null;

function normalizeBase64(input: string): string {
  // trim, remove surrounding quotes, remove whitespace/newlines
  let s = String(input ?? "").trim();

  // remove accidental surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  // remove all whitespace (including newlines)
  s = s.replace(/\s+/g, "");

  // allow base64url -> base64
  s = s.replace(/-/g, "+").replace(/_/g, "/");

  // padding
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";

  return s;
}

function safeKindOfDecoded(decoded: string): "json" | "pem" | "other" {
  const t = decoded.trim();
  if (t.startsWith("{")) return "json";
  if (t.includes("-----BEGIN PRIVATE KEY-----")) return "pem";
  return "other";
}

function getCredentialFromEnv(): admin.credential.Credential {
  // Option 1 (preferred): full service account JSON encoded as base64
  const b64Raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim();
  if (b64Raw) {
    // if user pasted JSON directly by accident, accept it too
    const direct = b64Raw.trim();
    if (direct.startsWith("{") && direct.endsWith("}")) {
      try {
        const json = JSON.parse(direct);
        return admin.credential.cert(json);
      } catch (e: any) {
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT_B64 looks like JSON but JSON.parse failed: ${e?.message ?? "unknown error"}`
        );
      }
    }

    // else: treat as base64/base64url
    const b64 = normalizeBase64(b64Raw);

    let decoded = "";
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_B64 could not be base64-decoded (length=${b64.length}).`
      );
    }

    const kind = safeKindOfDecoded(decoded);

    if (kind === "json") {
      try {
        const json = JSON.parse(decoded);
        return admin.credential.cert(json);
      } catch (e: any) {
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT_B64 decoded to something starting with "{", but JSON.parse still failed: ${e?.message ?? "unknown error"}`
        );
      }
    }

    if (kind === "pem") {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_B64 decodes to a PEM private key, not to a JSON service account. You likely encoded only "private_key". You must base64-encode the entire serviceAccount.json file content.`
      );
    }

    const preview = decoded.trim().slice(0, 24).replace(/[^\x20-\x7E]/g, "�");
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_B64 decoded content is not JSON (decodedKind=${kind}, decodedLen=${decoded.length}, preview="${preview}...").`
    );
  }

  // Option 2 (fallback): split env vars (also acceptable)
  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  let privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? "").trim();

  if (projectId && clientEmail && privateKey) {
    // Vercel often stores multiline keys with literal \n
    privateKey = privateKey.replace(/\\n/g, "\n");
    return admin.credential.cert({ projectId, clientEmail, privateKey } as any);
  }

  throw new Error(
    "Missing Firebase env vars. Set FIREBASE_SERVICE_ACCOUNT_B64 (preferred) OR FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY."
  );
}

function init() {
  if (admin.apps.length === 0) {
    const credential = getCredentialFromEnv();
    admin.initializeApp({ credential });
  }
  if (!_db) _db = admin.firestore();
}

/**
 * Optional: function form if you ever want it
 */
export function getDb() {
  init();
  return _db!;
}

/**
 * ✅ Standard export: Firestore INSTANCE (so you can do db.collection(...))
 */
export const db = getDb();
