import admin from "firebase-admin";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      "Missing Firebase env vars. Set FIREBASE_SERVICE_ACCOUNT_B64."
    );
  }
  return v;
}

function initAdmin() {
  if (admin.apps.length) return;

  // 🔐 Service Account als Base64 (robust, kein Zeilenumbruch-Stress)
  const b64 = getEnv("FIREBASE_SERVICE_ACCOUNT_B64");
  const json = JSON.parse(
    Buffer.from(b64, "base64").toString("utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(json),
  });
}

export function db() {
  initAdmin();
  return admin.firestore();
}
