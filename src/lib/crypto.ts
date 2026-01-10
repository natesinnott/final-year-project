import crypto from "node:crypto";

const SECRET_KEY_ENV = "SSO_SECRET_KEY";

function getSecretKey() {
  const key = process.env[SECRET_KEY_ENV];
  if (!key) {
    throw new Error(`Missing ${SECRET_KEY_ENV}`);
  }

  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) {
    throw new Error(`${SECRET_KEY_ENV} must be 32 bytes (base64-encoded)`);
  }

  return buffer;
}

export function encryptSecret(plainText: string) {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(encryptedValue: string) {
  const key = getSecretKey();
  const buffer = Buffer.from(encryptedValue, "base64");

  if (buffer.length < 29) {
    throw new Error("Encrypted secret is invalid");
  }

  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
