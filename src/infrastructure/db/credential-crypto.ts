import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getDbCredentialsEncryptionKey } from "@/domain/db/config";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey(getDbCredentialsEncryptionKey());
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const key = deriveKey(getDbCredentialsEncryptionKey());
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + 16 + 1) {
    throw new Error("Invalid encrypted secret blob");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
