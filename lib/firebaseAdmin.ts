import admin from "firebase-admin";

let _db: admin.firestore.Firestore | null = null;

function normalizeBase64(input: string): string {
  let s = String(input ?? "").trim();

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  s = s.replace(/\s+/g, "");
  s = s.replace(/-/g, "+").replace(/_/g, "/");

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
  const b64Raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "").trim();
  if (b64Raw) {
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

    const b64 = normalizeBase64(b64Raw);

    let decoded = "";
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_B64 could not be base64-decoded (length=${b64.length}).`);
    }

    const kind = safeKindOfDecoded(decoded);

    if (kind === "json") {
      try {
        const json = JSON.parse(decoded);
        return admin.credential.cert(json);
      } catch (e: any) {
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT_B64 decoded to JSON-like content, but JSON.parse failed: ${e?.message ?? "unknown error"}`
        );
      }
    }

    if (kind === "pem") {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_B64 decodes to a PEM private key, not a JSON service account. You likely encoded only "private_key". Base64-encode the entire serviceAccount.json content.`
      );
    }

    const preview = decoded.trim().slice(0, 24).replace(/[^\x20-\x7E]/g, "�");
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_B64 decoded content is not JSON (decodedKind=${kind}, decodedLen=${decoded.length}, preview="${preview}...").`
    );
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  let privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? "").trim();

  if (projectId && clientEmail && privateKey) {
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

    // ✅ Storage Support (für Bottle-Foto Uploads)
    // Wichtig: Setze in Vercel ENV: FIREBASE_STORAGE_BUCKET = "<projectId>.appspot.com"
    admin.initializeApp({
      credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  if (!_db) _db = admin.firestore();
}

function getDbInternal(): admin.firestore.Firestore {
  init();
  return _db!;
}

// ---- The important part: db is BOTH callable AND has Firestore methods ----
type DbFn = (() => admin.firestore.Firestore) & admin.firestore.Firestore;

export const db: DbFn = Object.assign(
  function dbFn() {
    return getDbInternal();
  },
  {
    // bind common methods so db.collection(...) works
    collection: (...args: any[]) => getDbInternal().collection(...(args as [any])),
    doc: (...args: any[]) => (getDbInternal() as any).doc(...args),
    batch: (...args: any[]) => (getDbInternal() as any).batch(...args),
    runTransaction: (...args: any[]) => (getDbInternal() as any).runTransaction(...args),
  }
) as any;

// Optional: explicit getter if you prefer it in new code
export function getDb() {
  return getDbInternal();
}
