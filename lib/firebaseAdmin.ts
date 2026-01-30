import admin from "firebase-admin";

function mustGet(name: string): string {
  const v = (process.env[name] ?? "").toString().trim();
  if (!v) throw new Error(`Missing Firebase env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.`);
  return v;
}

function normalizePrivateKey(raw: string): string {
  // Accept:
  // - real newlines
  // - "\n" escaped newlines
  // - accidental surrounding quotes
  const trimmed = raw.trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1");
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

export function db() {
  if (!admin.apps.length) {
    const projectId = mustGet("FIREBASE_PROJECT_ID");
    const clientEmail = mustGet("FIREBASE_CLIENT_EMAIL");
    const privateKeyRaw = mustGet("FIREBASE_PRIVATE_KEY");
    const privateKey = normalizePrivateKey(privateKeyRaw);

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return admin.firestore();
}
